const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

const ALLOWED_METHODS = ["GET", "OPTIONS"];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,Cache-Control,Pragma,X-Request-Id,x-request-id",
  "Access-Control-Expose-Headers": "X-BCRA-Cache,X-BCRA-Cache-Age,X-Request-Id",
  "Access-Control-Max-Age": "3600",
};

const buildBcraUrl = ({ cuil, historico }) => {
  const base = "https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas";
  if (historico) {
    return `${base}/Historicas/${cuil}`;
  }
  return `${base}/${cuil}`;
};

const normalizeBool = (value) => {
  if (value === true || value === "true" || value === "1") {
    return true;
  }
  return false;
};

const REQUEST_TIMEOUT_MS = 60000;
const RETRY_DELAYS_MS = [1500, 4000, 9000, 16000, 25000];
const HEALTHCHECK_TIMEOUT_MS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const computeRetryDelay = (attempt, response) => {
  const retryAfterHeader = response?.headers?.get?.("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 30000);
  }
  const baseDelay =
    RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] || RETRY_DELAYS_MS[0];
  const jitter = Math.floor(Math.random() * 500);
  return baseDelay + jitter;
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "microcuotas-bcra-proxy/1.0",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchWithTimeoutHealthcheck = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "microcuotas-bcra-proxy/1.0",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const CACHE_COLLECTION = "bcraCache";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const STALE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const LOG_COLLECTION = "bcraProxyLogs";

const buildCacheKey = (cuil, historico) => `${cuil}_${historico ? "1" : "0"}`;
const buildPayloadSnippet = (payload) => {
  if (!payload) {
    return "";
  }
  const value = typeof payload === "string" ? payload : JSON.stringify(payload);
  return value.length > 400 ? `${value.slice(0, 400)}...` : value;
};
const maskCuil = (cuil) => {
  const value = String(cuil || "");
  if (value.length !== 11) {
    return value;
  }
  return `${value.slice(0, 2)}*******${value.slice(-2)}`;
};
const hashCuil = (cuil) => {
  const value = String(cuil || "");
  if (!value) {
    return null;
  }
  return crypto.createHash("sha256").update(value).digest("hex");
};

const writeBcraLog = async (entry = {}) => {
  try {
    await db.collection(LOG_COLLECTION).add({
      ...entry,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("BCRA log write failed", {
      message: err?.message || "Unknown error",
      name: err?.name || null,
    });
  }
};

const readCachedPayload = async (cuil, historico, { allowExpired = false } = {}) => {
  const docRef = db.collection(CACHE_COLLECTION).doc(buildCacheKey(cuil, historico));
  const snap = await docRef.get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data();
  const updatedAt = data?.updatedAt?.toDate ? data.updatedAt.toDate() : null;
  if (!updatedAt) {
    return null;
  }
  const ageMs = Date.now() - updatedAt.getTime();
  if (!allowExpired && ageMs > CACHE_TTL_MS) {
    return null;
  }
  if (allowExpired && ageMs > STALE_CACHE_TTL_MS) {
    return null;
  }
  return { payload: data.payload ?? null, updatedAt, ageMs };
};

const writeCachedPayload = async (cuil, historico, payload) => {
  const docRef = db.collection(CACHE_COLLECTION).doc(buildCacheKey(cuil, historico));
  await docRef.set(
    {
      payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

exports.bcraProxy = functions
  .runWith({ timeoutSeconds: 90, memory: "256MB" })
  .https.onRequest(async (req, res) => {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (!ALLOWED_METHODS.includes(req.method)) {
      res.status(405).json({ status: 405, error: "Method not allowed" });
      return;
    }

    const cuil = String(req.query.cuil || "").replace(/\D/g, "");
    const historico = normalizeBool(req.query.historico);
    const healthcheck = normalizeBool(req.query.health);
    const requestId = String(req.get("x-request-id") || req.query.requestId || "").trim() || null;
    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }
    if (!cuil || cuil.length !== 11) {
      res.status(400).json({ status: 400, error: "CUIL inválido" });
      return;
    }

    const url = buildBcraUrl({ cuil, historico });

    if (healthcheck) {
      const startedAt = Date.now();
      try {
        const response = await fetchWithTimeoutHealthcheck(url);
        const status = response.status;
        const ok = status < 500;
        res.status(200).json({
          ok,
          status,
          historico,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        res.status(200).json({
          ok: false,
          status: null,
          historico,
          elapsedMs: Date.now() - startedAt,
          error: error?.message || "Unknown error",
        });
      }
      return;
    }

    const startedAt = Date.now();
    let lastError = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await fetchWithTimeout(url);
        const text = await response.text();
        let payload = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch (err) {
          payload = text;
        }

        if (!response.ok) {
          const retryable = [429, 500, 502, 503, 504].includes(response.status);
          const cached = await readCachedPayload(cuil, historico);
          const elapsedMs = Date.now() - startedAt;

          await writeBcraLog({
            requestId,
            cuilMasked: maskCuil(cuil),
            cuilHash: hashCuil(cuil),
            historico,
            attempt,
            elapsedMs,
            status: response.status,
            errorType: "upstream_error",
            payloadSnippet: buildPayloadSnippet(payload),
            cacheUsed: Boolean(cached),
          });

          if (retryable && attempt < RETRY_DELAYS_MS.length) {
            await sleep(computeRetryDelay(attempt, response));
            continue;
          }

          if (cached) {
            res.setHeader("X-BCRA-Cache", "HIT");
            res.setHeader("X-BCRA-Cache-Age", String(Math.round(cached.ageMs / 1000)));
            res.status(200).json(cached.payload);
            return;
          }
          const stale = await readCachedPayload(cuil, historico, { allowExpired: true });
          if (stale) {
            await writeBcraLog({
              requestId,
              cuilMasked: maskCuil(cuil),
              cuilHash: hashCuil(cuil),
              historico,
              attempt,
              elapsedMs,
              status: 200,
              errorType: "cache_stale",
              payloadSnippet: buildPayloadSnippet(stale.payload),
              cacheUsed: true,
            });
            res.setHeader("X-BCRA-Cache", "STALE");
            res.setHeader("X-BCRA-Cache-Age", String(Math.round(stale.ageMs / 1000)));
            res.status(200).json(stale.payload);
            return;
          }
          res.status(response.status).json({
            status: response.status,
            error: "BCRA upstream error",
            payload,
          });
          return;
        }

        await writeCachedPayload(cuil, historico, payload);
        await writeBcraLog({
          requestId,
          cuilMasked: maskCuil(cuil),
          cuilHash: hashCuil(cuil),
          historico,
          attempt,
          elapsedMs: Date.now() - startedAt,
          status: response.status,
          errorType: "ok",
          payloadSnippet: buildPayloadSnippet(payload),
          cacheUsed: false,
        });
        res.status(200).json(payload);
        return;
      } catch (error) {
        lastError = error;
        const elapsedMs = Date.now() - startedAt;
        console.error("BCRA proxy fetch failed", {
          url,
          attempt,
          elapsedMs,
          message: error?.message || "Unknown error",
          name: error?.name || null,
        });
        await writeBcraLog({
          requestId,
          cuilMasked: maskCuil(cuil),
          cuilHash: hashCuil(cuil),
          historico,
          attempt,
          elapsedMs,
          status: error?.status ?? null,
          errorType: "fetch_error",
          errorMessage: error?.message || "Unknown error",
        });

        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(computeRetryDelay(attempt, null));
        }
      }
    }
    const cached = await readCachedPayload(cuil, historico);
    if (cached) {
      await writeBcraLog({
        requestId,
        cuilMasked: maskCuil(cuil),
        cuilHash: hashCuil(cuil),
        historico,
        attempt: RETRY_DELAYS_MS.length + 1,
        elapsedMs: Date.now() - startedAt,
        status: 200,
        errorType: "cache_fallback",
        payloadSnippet: buildPayloadSnippet(cached.payload),
        cacheUsed: true,
      });
      res.setHeader("X-BCRA-Cache", "HIT");
      res.setHeader("X-BCRA-Cache-Age", String(Math.round(cached.ageMs / 1000)));
      res.status(200).json(cached.payload);
      return;
    }
    const stale = await readCachedPayload(cuil, historico, { allowExpired: true });
    if (stale) {
      await writeBcraLog({
        requestId,
        cuilMasked: maskCuil(cuil),
        cuilHash: hashCuil(cuil),
        historico,
        attempt: RETRY_DELAYS_MS.length + 1,
        elapsedMs: Date.now() - startedAt,
        status: 200,
        errorType: "cache_stale",
        payloadSnippet: buildPayloadSnippet(stale.payload),
        cacheUsed: true,
      });
      res.setHeader("X-BCRA-Cache", "STALE");
      res.setHeader("X-BCRA-Cache-Age", String(Math.round(stale.ageMs / 1000)));
      res.status(200).json(stale.payload);
      return;
    }

    res.status(502).json({
      status: 502,
      error: "BCRA proxy error",
      message: lastError?.message || "Unknown error",
    });
  });
