import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db, deleteDoc, fetchContactsData, deleteOldClientesBefore, logout } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import "../css/Report.css";
import Logo from "../assets/logo_textoblanco_fondotransp.png";
import { useGlobalLoadingEffect } from "../components/GlobalLoadingProvider";

import Banner from "../components/Header-Loged";

const iconStyle = {
  cursor: "pointer",
};

const headerStyle = {
  padding: "10px",
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
};

const normalizeText = (value) => String(value || "").toLowerCase().trim();

const toSafeString = (value) => (value === undefined || value === null ? "" : String(value));

const normalizeAndStripAccents = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const BCRA_PROXY_URL = process.env.REACT_APP_BCRA_PROXY_URL || "/api/bcra";
// Para healthcheck solo necesitamos que el servidor responda (2xx/4xx = OK, 5xx/timeout = CAÍDO).
// Usamos un CUIT/CUIL dummy de 11 dígitos para no depender de datos reales.
const BCRA_HEALTHCHECK_CUIL = process.env.REACT_APP_BCRA_HEALTHCHECK_CUIL || "20000000000";
const BCRA_HEALTHCHECK_TIMEOUT_MS = 9000;
const BCRA_MISSING_DATA_SHORT = "No pudimos validar la informacion del BCRA";
const BCRA_MISSING_DATA_NORMALIZED_PREFIX = normalizeAndStripAccents(BCRA_MISSING_DATA_SHORT);
const BCRA_TOOLTIP_DEUDA_ACTUAL_VERIFICADA =
  "Se obtuvieron exitosamente los datos de deudas actuales del BCRA";
const BCRA_TOOLTIP_DEUDA_HISTORICA_VERIFICADA =
  "Se obtuvieron exitosamente los datos de historial crediticio del BCRA";

const normalizeMotivoForReport = (value) => {
  const raw = toSafeString(value);
  const normalized = normalizeAndStripAccents(raw);
  if (!normalized) {
    return { text: raw, suppressDetail: false };
  }
  if (normalized.startsWith(BCRA_MISSING_DATA_NORMALIZED_PREFIX)) {
    return { text: BCRA_MISSING_DATA_SHORT, suppressDetail: true };
  }
  if (
    normalized.startsWith(
      normalizeAndStripAccents(RESULTADOS_EVALUACION.DEMASIADOS_ACTIVOS.descripcion)
    )
  ) {
    return { text: RESULTADOS_EVALUACION.DEMASIADOS_ACTIVOS.descripcion, suppressDetail: true };
  }
  if (normalized.startsWith(normalizeAndStripAccents(RESULTADOS_EVALUACION.MORA_ACTIVA.descripcion))) {
    return { text: RESULTADOS_EVALUACION.MORA_ACTIVA.descripcion, suppressDetail: true };
  }
  if (
    normalized.startsWith(
      normalizeAndStripAccents(RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS.descripcion)
    )
  ) {
    return { text: RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS.descripcion, suppressDetail: true };
  }
  return { text: raw, suppressDetail: false };
};

const RESULTADOS_EVALUACION = Object.freeze({
  MENOR_21: { codigo: 1, descripcion: "Rechazo por menor de 30 años." },
  DEMASIADOS_ACTIVOS: { codigo: 2, descripcion: "Rechazo por más de 5 productos activos." },
  MORA_ACTIVA: { codigo: 3, descripcion: "Rechazo por situación 2 de los activos." },
  HISTORIAL_SUPERIOR_DOS: {
    codigo: 4,
    descripcion: "Productos historicos alcanzan situacion 3, o no tiene prod. hist.",
  },
  APROBADO: {
    codigo: 5,
    descripcion: "Aprobado: ningun producto historico supera la situacion 2.",
  },
});

const MOTIVO_EDIT_OPTIONS = Object.freeze([
  {
    value: "resultado:5",
    label: RESULTADOS_EVALUACION.APROBADO.descripcion,
    update: {
      resultadoEvaluacionCodigo: RESULTADOS_EVALUACION.APROBADO.codigo,
      resultadoEvaluacionDescripcion: RESULTADOS_EVALUACION.APROBADO.descripcion,
      motivoRechazo: null,
      motivoRechazoCodigo: null,
    },
  },
  {
    value: "identidad_no_confirmada",
    label: "El usuario indico que no es la persona validada.",
    update: {
      resultadoEvaluacionCodigo: null,
      resultadoEvaluacionDescripcion: "El usuario indico que no es la persona validada.",
      motivoRechazo: "El usuario indico que no es la persona validada.",
      motivoRechazoCodigo: "identidad_no_confirmada",
    },
  },
  {
    value: "bcra_sin_datos",
    label: "No pudimos validar la informacion del BCRA",
    update: {
      resultadoEvaluacionCodigo: null,
      resultadoEvaluacionDescripcion: "No pudimos validar la informacion del BCRA",
      motivoRechazo: "No pudimos validar la informacion del BCRA",
      motivoRechazoCodigo: "bcra_sin_datos",
    },
  },
  {
    value: "menor_21",
    label: RESULTADOS_EVALUACION.MENOR_21.descripcion,
    update: {
      resultadoEvaluacionCodigo: RESULTADOS_EVALUACION.MENOR_21.codigo,
      resultadoEvaluacionDescripcion: RESULTADOS_EVALUACION.MENOR_21.descripcion,
      motivoRechazo: RESULTADOS_EVALUACION.MENOR_21.descripcion,
      motivoRechazoCodigo: "menor_21",
    },
  },
  {
    value: "bcra_demasiados_activos",
    label: RESULTADOS_EVALUACION.DEMASIADOS_ACTIVOS.descripcion,
    update: {
      resultadoEvaluacionCodigo: RESULTADOS_EVALUACION.DEMASIADOS_ACTIVOS.codigo,
      resultadoEvaluacionDescripcion: RESULTADOS_EVALUACION.DEMASIADOS_ACTIVOS.descripcion,
      motivoRechazo: RESULTADOS_EVALUACION.DEMASIADOS_ACTIVOS.descripcion,
      motivoRechazoCodigo: "bcra_demasiados_activos",
    },
  },
  {
    value: "bcra_mora_activa",
    label: RESULTADOS_EVALUACION.MORA_ACTIVA.descripcion,
    update: {
      resultadoEvaluacionCodigo: RESULTADOS_EVALUACION.MORA_ACTIVA.codigo,
      resultadoEvaluacionDescripcion: RESULTADOS_EVALUACION.MORA_ACTIVA.descripcion,
      motivoRechazo: RESULTADOS_EVALUACION.MORA_ACTIVA.descripcion,
      motivoRechazoCodigo: "bcra_mora_activa",
    },
  },
  {
    value: "bcra_mora_historica",
    label: RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS.descripcion,
    update: {
      resultadoEvaluacionCodigo: RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS.codigo,
      resultadoEvaluacionDescripcion: RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS.descripcion,
      motivoRechazo: RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS.descripcion,
      motivoRechazoCodigo: "bcra_mora_historica",
    },
  },
]);

const resolveMotivoEditValue = (cliente = {}) => {
  const rawCodigo = toSafeString(
    cliente.motivoRechazoCodigo ?? cliente.resultadoEvaluacionCodigo ?? ""
  ).trim();
  if (rawCodigo) {
    const normalized = normalizeText(rawCodigo);
    if (normalized === "5" || normalized === "resultado:5") {
      return "resultado:5";
    }
    if (MOTIVO_EDIT_OPTIONS.some((option) => option.value === rawCodigo)) {
      return rawCodigo;
    }
    if (MOTIVO_EDIT_OPTIONS.some((option) => option.value === normalized)) {
      return normalized;
    }
  }

  const resolved = toSafeString(cliente._resolvedMotivo || cliente.resultadoEvaluacionDescripcion || cliente.motivoRechazo);
  const normalizedResolved = normalizeText(resolved);
  const byLabel = MOTIVO_EDIT_OPTIONS.find(
    (option) => normalizeText(option.label) === normalizedResolved
  );
  return byLabel?.value || "";
};


const isMinor30Rejection = (cliente = {}) => {
  const normalizedMotivoCodigo = normalizeText(
    cliente.motivoRechazoCodigo ?? cliente.resultadoEvaluacionCodigo
  );
  const normalizedResultadoCodigo = normalizeText(cliente.resultadoEvaluacionCodigo);

  if (
    normalizedMotivoCodigo === "menor_21" ||
    normalizedMotivoCodigo === "1" ||
    normalizedResultadoCodigo === "1"
  ) {
    return true;
  }

  const descripcionNormalizada = normalizeAndStripAccents(
    cliente.resultadoEvaluacionDescripcion || cliente.motivoRechazo || ""
  );
  if (!descripcionNormalizada) {
    return false;
  }
  return descripcionNormalizada.includes("menor de 30");
};

const filterVisibleClientes = (rows = []) => rows.filter((cliente) => !isMinor30Rejection(cliente));

const parseDateInput = (value, { endOfDay = false } = {}) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
};

const firebaseTimestampToDate = (timestamp) => {
  if (!timestamp || typeof timestamp.seconds !== "number") {
    return null;
  }
  const millis = timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1_000_000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateOnlyLabel = (date) => (date ? date.toLocaleDateString("es-AR") : "");
const formatDateTimeLabel = (date) =>
  date
    ? date.toLocaleString("es-AR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

const parseBirthdateValue = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  // Most common: <input type="date"> => YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Fallback: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const computeAgeYears = (birthDate, referenceDate) => {
  if (!birthDate || !referenceDate) {
    return null;
  }
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = referenceDate.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return Number.isFinite(age) ? age : null;
};

const buildClienteDerivedData = (cliente) => {
  const timestampDate = firebaseTimestampToDate(cliente.timestamp);
  const timestampLabel = formatDateOnlyLabel(timestampDate);
  const timestampLabelWithTime = formatDateTimeLabel(timestampDate);
  const birthDate = parseBirthdateValue(cliente.fechaNacimiento);
  const edad = computeAgeYears(birthDate, timestampDate || new Date());
  const normalizedEstado = normalizeText(cliente.estado);
  const rejectionReasonRaw = toSafeString(cliente.motivoRechazo);
  const resultadoDescripcionRaw = toSafeString(cliente.resultadoEvaluacionDescripcion);
  const aceptada = normalizedEstado === "aceptada";
  const resolvedMotivoBase =
    resultadoDescripcionRaw ||
    (aceptada ? "Procesamiento satisfactorio" : rejectionReasonRaw || "Motivo no informado");
  const resolvedMotivoInfo = normalizeMotivoForReport(resolvedMotivoBase);
  const resolvedMotivo = resolvedMotivoInfo.text;
  const suppressMotivoDetalle =
    resolvedMotivoInfo.suppressDetail ||
    normalizeMotivoForReport(rejectionReasonRaw).suppressDetail ||
    normalizeMotivoForReport(resultadoDescripcionRaw).suppressDetail;
  const normalizedResolvedMotivo = normalizeText(resolvedMotivo);
  const rawMotivoCodigo = toSafeString(
    cliente.resultadoEvaluacionCodigo ?? cliente.motivoRechazoCodigo ?? ""
  ).trim();
  const hasCodigo =
    rawMotivoCodigo &&
    !["", "null", "undefined"].includes(rawMotivoCodigo.toLowerCase());
  const motivoOptionValue = hasCodigo ? rawMotivoCodigo : normalizedResolvedMotivo || resolvedMotivo;
  const normalizedTipoPrestamo = normalizeText(cliente.tipoPrestamo);
  const fallbackTipo =
    normalizedTipoPrestamo ||
    (normalizeText(cliente.origen || "").includes("tarjeta")
      ? "tarjeta"
      : aceptada
      ? "personal"
      : "");
  const tipoPrestamoLabel =
    fallbackTipo === "tarjeta"
      ? "Tarjeta"
      : fallbackTipo === "personal"
      ? "Personal"
      : "No especificado";

  const searchableValues = [
    cliente.cuil,
    cliente.nombre,
    cliente.apellido,
    cliente.telefono,
    cliente.email,
    cliente.estado,
    cliente.motivoRechazo,
    cliente.motivoRechazoCodigo,
    cliente.resultadoEvaluacionDescripcion,
    cliente.resultadoEvaluacionCodigo,
    cliente.cuotas,
    cliente.monto,
    edad,
    timestampLabel,
    timestampLabelWithTime,
    resolvedMotivo,
    tipoPrestamoLabel,
  ].map(toSafeString);
  const searchableText = normalizeText(searchableValues.join(" "));

  return {
    ...cliente,
    _timestampDate: timestampDate,
    _timestampLabel: timestampLabel,
    _timestampLabelWithTime: timestampLabelWithTime,
    _birthDate: birthDate,
    _edad: edad,
    _searchableText: searchableText,
    _resolvedMotivo: resolvedMotivo,
    _normalizedMotivo: normalizedResolvedMotivo,
    _motivoOptionValue: motivoOptionValue,
    _estadoNormalized: normalizedEstado,
    _tipoPrestamo: fallbackTipo || "",
    _tipoPrestamoLabel: tipoPrestamoLabel,
    _suppressMotivoDetalle: suppressMotivoDetalle,
  };
};

const toIsoStringOrNull = (date) => (date ? date.toISOString() : null);

const COLUMN_FILTER_DEFAULTS = Object.freeze({
  cuil: "todos",
  nombre: "todos",
  apellido: "todos",
  telefono: "todos",
  email: "todos",
  tipoPrestamo: "todos",
  fecha: "todos",
});

const INITIAL_LIMIT = 200;
const BACKGROUND_LIMIT = 300;
const CACHE_KEY_PREFIX = "reportCache_v1";
const FETCH_TIMEOUT_MS = 60000;

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("request-timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const buildCacheKey = (start, end) => `${CACHE_KEY_PREFIX}:${start || "none"}:${end || "none"}`;

const mergeClientesById = (existing = [], incoming = []) => {
  const map = new Map();

  existing.forEach((cliente) => {
    const key = cliente.id || `existing-${map.size}`;
    map.set(key, cliente);
  });

  incoming.forEach((cliente) => {
    const key = cliente.id || `incoming-${map.size}`;
    map.set(key, cliente);
  });

  const merged = Array.from(map.values());
  return merged.sort(
    (a, b) => (b._timestampDate?.getTime() || 0) - (a._timestampDate?.getTime() || 0)
  );
};

const clearReportCache = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("No se pudo limpiar el cache local del reporte:", error);
  }
};

export default function Admin() {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const [fullClientesData, setFullClientesData] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [appliedStartDate, setAppliedStartDate] = useState(null);
  const [appliedEndDate, setAppliedEndDate] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortMethod, setSortMethod] = useState(""); // New state for sorting method
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [motivoFiltro, setMotivoFiltro] = useState("todos");
  const [columnFilters, setColumnFilters] = useState(() => ({ ...COLUMN_FILTER_DEFAULTS }));
  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isPurgingOld, setIsPurgingOld] = useState(false);
  const [isPrefetchingOld, setIsPrefetchingOld] = useState(false);
  const [lastFetchedCursor, setLastFetchedCursor] = useState(null);
  const [hasMoreData, setHasMoreData] = useState(false);
  const backgroundRunIdRef = useRef(0);
  const lastFetchParamsRef = useRef({ start: undefined, end: undefined });
  const purgeRunRef = useRef(false);
  const [currentCacheKey, setCurrentCacheKey] = useState(null);
  const [editingMotivoId, setEditingMotivoId] = useState(null);
  const [editingMotivoValue, setEditingMotivoValue] = useState("");
  const [savingMotivoId, setSavingMotivoId] = useState(null);
  const [bcraHealth, setBcraHealth] = useState(() => ({
    deudas: { loading: true, ok: null, status: null },
    historico: { loading: true, ok: null, status: null },
  }));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectAllRef = useRef(null);

  useGlobalLoadingEffect(loading || isLoadingData || isPurgingOld);

  const purgeOldRecords = useCallback(async () => {
    if (purgeRunRef.current) {
      return;
    }
    purgeRunRef.current = true;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);

    clearReportCache();

    try {
      setIsPurgingOld(true);
      let hasMore = true;
      while (hasMore) {
        const result = await deleteOldClientesBefore(cutoff, { batchSize: 500 });
        hasMore = Boolean(result?.hasMore) && (result?.deleted || 0) > 0;
        if (!hasMore) {
          break;
        }
      }
    } catch (error) {
      console.error("Error eliminando registros antiguos:", error);
    } finally {
      setIsPurgingOld(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedBusqueda(busquedaGeneral);
    }, 300);
    return () => clearTimeout(timeout);
  }, [busquedaGeneral]);

  useEffect(() => {
    if (!selectedIds.size) {
      return;
    }
    const existingIds = new Set(
      (Array.isArray(fullClientesData) ? fullClientesData : [])
        .map((cliente) => cliente?.id)
        .filter(Boolean)
    );
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (existingIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [fullClientesData, selectedIds]);

  useEffect(() => {
    // Evitamos ruido y requests de red en tests.
    if (process.env.NODE_ENV === "test") {
      return;
    }

    let cancelled = false;

    const runCheck = async (key, historico) => {
      setBcraHealth((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: true },
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BCRA_HEALTHCHECK_TIMEOUT_MS);
      try {
        const params = new URLSearchParams({
          cuil: String(BCRA_HEALTHCHECK_CUIL),
          historico: historico ? "1" : "0",
          health: "1",
        });
        const response = await fetch(`${BCRA_PROXY_URL}?${params.toString()}`, {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        const ok = Boolean(payload?.ok);
        const status = payload?.status ?? null;
        if (!cancelled) {
          setBcraHealth((prev) => ({
            ...prev,
            [key]: { loading: false, ok, status },
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setBcraHealth((prev) => ({
            ...prev,
            [key]: { loading: false, ok: false, status: null },
          }));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    runCheck("deudas", false);
    runCheck("historico", true);

    return () => {
      cancelled = true;
    };
  }, []);

  const loadClientes = useCallback(
    async ({ start, end, force = false } = {}) => {
      const normalizedStart = start ?? null;
      const normalizedEnd = end ?? null;
      const cacheKey = buildCacheKey(normalizedStart, normalizedEnd);
      setCurrentCacheKey(cacheKey);

      if (
        !force &&
        lastFetchParamsRef.current.start === normalizedStart &&
        lastFetchParamsRef.current.end === normalizedEnd
      ) {
        return;
      }

      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const cachedRows = Array.isArray(cached?.rows) ? cached.rows : [];
          if (cachedRows.length) {
            const visibleCachedRows = filterVisibleClientes(cachedRows);
            const enrichedCached = visibleCachedRows.map(buildClienteDerivedData);
            setFullClientesData(enrichedCached);
            setPage(0);
          }
        }
      } catch (error) {
        console.warn("No se pudo leer cache local del reporte:", error);
      }

      backgroundRunIdRef.current += 1;
      setIsPrefetchingOld(false);
      setHasMoreData(false);
      setLastFetchedCursor(null);
      setIsLoadingData(true);
      try {
        const result = await withTimeout(
          fetchContactsData({
          startDate: normalizedStart,
          endDate: normalizedEnd,
          limit: INITIAL_LIMIT,
          withCursor: true,
          }),
          FETCH_TIMEOUT_MS
        );

        const rows = Array.isArray(result?.rows)
          ? result.rows
          : Array.isArray(result)
          ? result
          : [];
        const visibleRows = filterVisibleClientes(rows);
        const enrichedRows = visibleRows.map(buildClienteDerivedData);

        setFullClientesData(enrichedRows);
        setPage(0);
        setLastFetchedCursor(result?.lastDoc || null);
        const moreAvailable = Boolean(result?.lastDoc) && rows.length >= INITIAL_LIMIT;
        setHasMoreData(moreAvailable);
        lastFetchParamsRef.current = { start: normalizedStart, end: normalizedEnd };

        try {
          const serialized = visibleRows.map(
            ({
              _timestampDate,
              _timestampLabel,
              _timestampLabelWithTime,
              _searchableText,
              _resolvedMotivo,
              _normalizedMotivo,
              _motivoOptionValue,
              _estadoNormalized,
              _tipoPrestamo,
              _tipoPrestamoLabel,
              ...rest
            }) => rest
          );
          localStorage.setItem(cacheKey, JSON.stringify({ rows: serialized, savedAt: Date.now() }));
        } catch (error) {
          console.warn("No se pudo guardar cache local del reporte:", error);
        }
      } catch (error) {
        if (error?.message === "request-timeout") {
          console.error("Timeout buscando datos del reporte.");
          alert("La consulta está tardando demasiado. Probá nuevamente con un rango más chico.");
        } else {
          console.error("Error fetching data:", error);
        }
      } finally {
        setIsLoadingData(false);
      }
    },
    [setFullClientesData, setIsLoadingData, setPage, fetchContactsData, setCurrentCacheKey]
  );

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    const run = async () => {
      await loadClientes({ force: true });
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loading, user, navigate, loadClientes, purgeOldRecords]);

  useEffect(() => {
    if (!hasMoreData || isPrefetchingOld || !lastFetchedCursor) {
      return;
    }

    let isCancelled = false;
    const runId = backgroundRunIdRef.current;

    const fetchInBackground = async () => {
      setIsPrefetchingOld(true);
      try {
        let cursor = lastFetchedCursor;
        let more = true;

        while (more && !isCancelled) {
          if (runId !== backgroundRunIdRef.current) {
            break;
          }

          const result = await withTimeout(
            fetchContactsData({
            startDate: lastFetchParamsRef.current.start,
            endDate: lastFetchParamsRef.current.end,
            limit: BACKGROUND_LIMIT,
            startAfter: cursor,
            withCursor: true,
            }),
            FETCH_TIMEOUT_MS
          );

          const rows = Array.isArray(result?.rows)
            ? result.rows
            : Array.isArray(result)
            ? result
            : [];
          const visibleRows = filterVisibleClientes(rows);

          if (!rows.length) {
            more = false;
            break;
          }

          if (runId !== backgroundRunIdRef.current) {
            break;
          }

          const enrichedRows = visibleRows.map(buildClienteDerivedData);
          setFullClientesData((prev) => mergeClientesById(prev, enrichedRows));

          cursor = result?.lastDoc || null;
          more = Boolean(cursor) && rows.length >= BACKGROUND_LIMIT;
          setLastFetchedCursor(cursor);
          setHasMoreData(more);
        }

        if (!isCancelled) {
          setHasMoreData(false);
          setLastFetchedCursor(cursor);
        }
      } catch (error) {
        console.error("Error fetching additional data:", error);
      } finally {
        if (!isCancelled) {
          setIsPrefetchingOld(false);
        }
      }
    };

    fetchInBackground();

    return () => {
      isCancelled = true;
    };
  }, [hasMoreData, isPrefetchingOld, lastFetchedCursor]);

  useEffect(() => {
    if (!currentCacheKey) {
      return;
    }
    if (isLoadingData || isPrefetchingOld) {
      return;
    }
    try {
      const serialized = fullClientesData.map(
        ({
          _timestampDate,
          _timestampLabel,
          _searchableText,
          _resolvedMotivo,
          _normalizedMotivo,
          _motivoOptionValue,
          _estadoNormalized,
          _tipoPrestamo,
          _tipoPrestamoLabel,
          ...rest
        }) => rest
      );
      localStorage.setItem(currentCacheKey, JSON.stringify({ rows: serialized, savedAt: Date.now() }));
    } catch (error) {
      console.warn("No se pudo actualizar cache local del reporte:", error);
    }
  }, [fullClientesData, currentCacheKey, isLoadingData, isPrefetchingOld]);


  const toExport = () => {
    let header = [
      "nombre",
      "apellido",
      "cuil",
      "telefono",
      "email",
      "monto",
      "cuotas",
      "tipoPrestamo",
      "estado",
      "Deuda Actual Verificada",
      "Deuda Histórica Verificada",
      "motivoRechazo",
      "motivoRechazoCodigo",
      "resultadoEvaluacionCodigo",
      "resultadoEvaluacionDescripcion",
      "ingresoMensual",
      "fechaIngreso",
      "fechaSolicitud",
      "\n",
    ];
    let csvRows = filteredData.map((e) => {
    let _ = [];
    _[0] = e.nombre;
    _[1] = e.apellido;
    _[2] = e.cuil;
    _[3] = e.telefono;
    _[4] = e.email || "";
    _[5] = e.monto;
    _[6] = e.cuotas;
    _[7] = e._tipoPrestamoLabel || e.tipoPrestamo || "";
    _[8] = e.estado || "";
    _[9] = e.bcraDeudaActualVerificada ? "Sí" : "No";
    _[10] = e.bcraDeudaHistoricaVerificada ? "Sí" : "No";
    _[11] = e._resolvedMotivo || e.motivoRechazo || "";
    _[12] = e.motivoRechazoCodigo || "";
    _[13] = e.resultadoEvaluacionCodigo || "";
    _[14] = normalizeMotivoForReport(e.resultadoEvaluacionDescripcion).text || "";
    _[15] = e.ingresoMensual || "";
    _[16] = e.fechaIngreso ? `"${e.fechaIngreso}"` : "";
    const fecha = e._timestampDate || firebaseTimestampToDate(e.timestamp);
    _[17] = fecha ? fecha.toISOString() : "";
    _[18] = "\n";
    return _;
  });
    var pom = document.createElement("a");
    var blob = new Blob([header, ...csvRows], {
      type: "text/csv;charset=utf-8;",
    });
    var url = URL.createObjectURL(blob);
    pom.href = url;
    pom.setAttribute("download", "download.csv");
    pom.click();
    alert("Archivo exportado correctamente");
  };

  const handleBusquedaChange = (event) => {
    const value = event.target.value;
    setBusquedaGeneral(value);
    setPage(0);
  };

  const handleClearBusqueda = () => {
    setBusquedaGeneral("");
    setPage(0);
  };

  const filterData = () => {
    const startBoundary = parseDateInput(startDate);
    const endBoundary = parseDateInput(endDate, { endOfDay: true });

    if (startBoundary && endBoundary && startBoundary > endBoundary) {
      alert("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    setAppliedStartDate(startBoundary);
    setAppliedEndDate(endBoundary);
    setPage(0);
    loadClientes({
      start: toIsoStringOrNull(startBoundary),
      end: toIsoStringOrNull(endBoundary),
    });
  };

  const handleDelete = async (recordId) => {
    if (window.confirm("Estas seguro de eliminar este registro?")) {
      setIsLoadingData(true);
      try {
        const docRef = doc(db, "clientes", recordId);
        await deleteDoc(docRef);
        const updatedFull = fullClientesData.filter((cliente) => cliente.id !== recordId);
        setFullClientesData(updatedFull);
        setPage((prev) =>
          Math.max(0, Math.min(prev, Math.ceil((updatedFull.length || 0) / pageSize) - 1))
        );
        alert("Registro eliminado correctamente");
      } catch (error) {
        console.error("Error eliminando el cliente:", error.message);
        alert("Hubo un error eliminando el cliente. Por favor volve a intentarlo.");
      } finally {
        setIsLoadingData(false);
      }
    }
  };

  const toggleRowSelected = (recordId) => {
    if (!recordId || isBulkDeleting || isLoadingData) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelected = async (idsToDelete) => {
    const ids = Array.isArray(idsToDelete) ? idsToDelete.filter(Boolean) : [];
    if (!ids.length || isBulkDeleting) {
      return;
    }

    const count = ids.length;
    if (!window.confirm(`¿Eliminar ${count} registro${count === 1 ? "" : "s"} seleccionado${count === 1 ? "" : "s"}?`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const chunkSize = 20;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          chunk.map(async (id) => {
            const docRef = doc(db, "clientes", id);
            await deleteDoc(docRef);
          })
        );
      }

      setFullClientesData((prev) =>
        (Array.isArray(prev) ? prev : []).filter((cliente) => !ids.includes(cliente.id))
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      alert("Registros eliminados correctamente");
    } catch (error) {
      console.error("Error eliminando registros seleccionados:", error);
      alert("Hubo un error eliminando los registros seleccionados. Por favor volve a intentarlo.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAllOnPage = () => {
    if (!pageIds.length || isBulkDeleting || isLoadingData) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.every((id) => next.has(id));
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const beginEditMotivo = (cliente) => {
    if (!cliente?.id) {
      return;
    }
    if (savingMotivoId) {
      return;
    }
    setEditingMotivoId(cliente.id);
    setEditingMotivoValue(resolveMotivoEditValue(cliente));
  };

  const cancelEditMotivo = () => {
    if (savingMotivoId) {
      return;
    }
    setEditingMotivoId(null);
    setEditingMotivoValue("");
  };

  const saveMotivoForCliente = async (cliente, nextValue) => {
    if (!cliente?.id || savingMotivoId) {
      return;
    }
    const option = MOTIVO_EDIT_OPTIONS.find((entry) => entry.value === nextValue);
    if (!option) {
      cancelEditMotivo();
      return;
    }

    setSavingMotivoId(cliente.id);
    try {
      const docRef = doc(db, "clientes", cliente.id);
      await updateDoc(docRef, option.update);
      setFullClientesData((prev) =>
        (Array.isArray(prev) ? prev : []).map((row) =>
          row.id === cliente.id ? buildClienteDerivedData({ ...row, ...option.update }) : row
        )
      );
      cancelEditMotivo();
    } catch (error) {
      console.error("Error actualizando motivo de rechazo:", error);
      const message = String(error?.message || "");
      const isPermissionDenied =
        error?.code === "permission-denied" || message.toLowerCase().includes("missing or insufficient permissions");
      alert(
        isPermissionDenied
          ? "No tenés permisos para editar el motivo en Firestore (permission-denied). Verificá haber desplegado `firestore.rules` en el proyecto correcto y estar logueado."
          : "Hubo un error actualizando el motivo de rechazo. Por favor volve a intentarlo."
      );
      cancelEditMotivo();
    } finally {
      setSavingMotivoId(null);
    }
  };

  const sorters = {
    sortByIdAscend: (a, b) => String(a.cuil || "").localeCompare(String(b.cuil || "")),
    sortByNombreAscend: (a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")),
    sortByApellidoAscend: (a, b) => String(a.apellido || "").localeCompare(String(b.apellido || "")),
    sortByTelefonoAscend: (a, b) => String(a.telefono || "").localeCompare(String(b.telefono || "")),
    sortByEmailAscend: (a, b) => String(a.email || "").localeCompare(String(b.email || "")),
    sortByFechaSolicitudAscend: (a, b) =>
      (a._timestampDate?.getTime() || 0) - (b._timestampDate?.getTime() || 0),
    sortByFechaSolicitudDescend: (a, b) =>
      (b._timestampDate?.getTime() || 0) - (a._timestampDate?.getTime() || 0),
  };

  const filteredData = useMemo(() => {
    let filtered = Array.isArray(fullClientesData) ? [...fullClientesData] : [];

    if (appliedStartDate || appliedEndDate) {
      filtered = filtered.filter((cliente) => {
        const fecha = cliente._timestampDate || firebaseTimestampToDate(cliente.timestamp);
        if (!fecha) {
          return false;
        }
        if (appliedStartDate && fecha < appliedStartDate) {
          return false;
        }
        if (appliedEndDate && fecha > appliedEndDate) {
          return false;
        }
        return true;
      });
    }

    if (estadoFiltro !== "todos") {
      filtered = filtered.filter((cliente) => {
        const normalizedEstado = cliente._estadoNormalized || normalizeText(cliente.estado);
        if (estadoFiltro === "aceptada") {
          return normalizedEstado === "aceptada";
        }
        if (estadoFiltro === "rechazada") {
          return normalizedEstado === "rechazada";
        }
        return normalizedEstado === "pendiente";
      });
    }

    if (motivoFiltro !== "todos") {
      filtered = filtered.filter((cliente) => {
        if (cliente._motivoOptionValue) {
          return cliente._motivoOptionValue === motivoFiltro;
        }
        const codigo = toSafeString(
          cliente.resultadoEvaluacionCodigo ?? cliente.motivoRechazoCodigo ?? ""
        ).trim();
        if (codigo && motivoFiltro === codigo) {
          return true;
        }
        const normalizedDescripcion = normalizeText(
          toSafeString(cliente.resultadoEvaluacionDescripcion || cliente.motivoRechazo)
        );
        const normalizedFilter = normalizeText(motivoFiltro || "");
        return normalizedFilter && normalizedFilter === normalizedDescripcion;
      });
    }

    if (columnFilters.cuil && columnFilters.cuil !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.cuil || "") === columnFilters.cuil);
    }

    if (columnFilters.nombre && columnFilters.nombre !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.nombre || "") === columnFilters.nombre);
    }

    if (columnFilters.apellido && columnFilters.apellido !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.apellido || "") === columnFilters.apellido);
    }

    if (columnFilters.telefono && columnFilters.telefono !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.telefono || "") === columnFilters.telefono);
    }

    if (columnFilters.email && columnFilters.email !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.email || "") === columnFilters.email);
    }

    if (columnFilters.tipoPrestamo && columnFilters.tipoPrestamo !== "todos") {
      filtered = filtered.filter((cliente) => {
        const normalizedTipo = cliente._tipoPrestamo || normalizeText(cliente.tipoPrestamo);
        const normalizedLabel = normalizeText(cliente._tipoPrestamoLabel || "");
        const normalizedFilter = normalizeText(columnFilters.tipoPrestamo);
        return normalizedTipo === normalizedFilter || normalizedLabel === normalizedFilter;
      });
    }

    if (columnFilters.fecha && columnFilters.fecha !== "todos") {
      filtered = filtered.filter((cliente) => {
        if (cliente._timestampLabel) {
          return cliente._timestampLabel === columnFilters.fecha;
        }
        const fallbackDate = firebaseTimestampToDate(cliente.timestamp);
        return fallbackDate ? formatDateOnlyLabel(fallbackDate) === columnFilters.fecha : false;
      });
    }

    const normalizedSearch = normalizeText(debouncedBusqueda);
    if (normalizedSearch) {
      filtered = filtered.filter((cliente) => {
        const searchableText =
          cliente._searchableText ||
          normalizeText(
            [
              cliente.cuil,
              cliente.nombre,
              cliente.apellido,
              cliente.telefono,
              cliente.email,
              cliente.estado,
              cliente.motivoRechazo,
              cliente.motivoRechazoCodigo,
              cliente.resultadoEvaluacionDescripcion,
              cliente.resultadoEvaluacionCodigo,
              cliente.cuotas,
              cliente.monto,
              cliente._timestampLabelWithTime,
              cliente._timestampLabel ||
                formatDateOnlyLabel(firebaseTimestampToDate(cliente.timestamp)),
            ]
              .map(toSafeString)
              .join(" ")
          );
        return searchableText.includes(normalizedSearch);
      });
    }

    const sorter = sortMethod && sorters[sortMethod];
    return sorter ? [...filtered].sort(sorter) : filtered;
  }, [
    fullClientesData,
    estadoFiltro,
    motivoFiltro,
    columnFilters,
    debouncedBusqueda,
    sortMethod,
    appliedStartDate,
    appliedEndDate,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((filteredData.length || 0) / pageSize)),
    [filteredData.length, pageSize]
  );

  const paginatedrecords = useMemo(() => {
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, totalPages, pageSize]);

  const pageIds = useMemo(
    () => paginatedrecords.map((cliente) => cliente?.id).filter(Boolean),
    [paginatedrecords]
  );

  const selectedCount = selectedIds.size;

  const isAllSelectedOnPage = useMemo(() => {
    if (!pageIds.length) {
      return false;
    }
    return pageIds.every((id) => selectedIds.has(id));
  }, [pageIds, selectedIds]);

  const isSomeSelectedOnPage = useMemo(() => {
    if (!pageIds.length) {
      return false;
    }
    return pageIds.some((id) => selectedIds.has(id));
  }, [pageIds, selectedIds]);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = Boolean(isSomeSelectedOnPage && !isAllSelectedOnPage);
  }, [isSomeSelectedOnPage, isAllSelectedOnPage]);

  useEffect(() => {
    const safePage = Math.min(page, totalPages - 1);
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, totalPages]);

  const applySortAndFilters = (method) => {
    setSortMethod(method);
    setPage(0);
  };

  const sortByIdAscend = () => applySortAndFilters("sortByIdAscend");

  const sortByNombreAscend = () => applySortAndFilters("sortByNombreAscend");

  const sortByApellidoAscend = () => applySortAndFilters("sortByApellidoAscend");

  const sortByTelefonoAscend = () => applySortAndFilters("sortByTelefonoAscend");

  const sortByEmailAscend = () => applySortAndFilters("sortByEmailAscend");

  const sortByFechaSolicitudAscend = () => applySortAndFilters("sortByFechaSolicitudAscend");

  const sortByFechaSolicitudDescend = () => applySortAndFilters("sortByFechaSolicitudDescend");

  const goToPage = (targetPage) => {
    const safeTarget = Math.max(0, Math.min(targetPage, totalPages - 1));
    setPage(safeTarget);
  };

  const handlePageSizeChange = (event) => {
    const value = Number(event.target.value) || 10;
    setPageSize(value);
    setPage(0);
  };

  const estadoOptions = [
    { value: "todos", label: "Todos los estados" },
    { value: "aceptada", label: "Solicitudes aceptadas" },
    { value: "rechazada", label: "Solicitudes rechazadas" },
    { value: "pendiente", label: "Solicitudes pendientes" },
  ];

  const columnOptions = useMemo(() => {
    const sets = {
      cuil: new Set(),
      nombre: new Set(),
      apellido: new Set(),
      telefono: new Set(),
      email: new Set(),
      tipoPrestamo: new Set(),
      fecha: new Set(),
    };

    fullClientesData.forEach((cliente) => {
      if (cliente.cuil) {
        sets.cuil.add(String(cliente.cuil));
      }
      if (cliente.nombre) {
        sets.nombre.add(String(cliente.nombre));
      }
      if (cliente.apellido) {
        sets.apellido.add(String(cliente.apellido));
      }
      if (cliente.telefono) {
        sets.telefono.add(String(cliente.telefono));
      }
      if (cliente.email) {
        sets.email.add(String(cliente.email));
      }
      if (cliente._tipoPrestamoLabel) {
        sets.tipoPrestamo.add(String(cliente._tipoPrestamoLabel));
      }
      const fecha =
        cliente._timestampLabel ||
        formatDateOnlyLabel(firebaseTimestampToDate(cliente.timestamp));
      if (fecha) {
        sets.fecha.add(fecha);
      }
    });

    const toSortedArray = (set) => Array.from(set).sort((a, b) => a.localeCompare(b));

    return {
      cuil: toSortedArray(sets.cuil),
      nombre: toSortedArray(sets.nombre),
      apellido: toSortedArray(sets.apellido),
      telefono: toSortedArray(sets.telefono),
      email: toSortedArray(sets.email),
      tipoPrestamo: toSortedArray(sets.tipoPrestamo),
      fecha: toSortedArray(sets.fecha),
    };
  }, [fullClientesData]);

  const motivoOptions = useMemo(() => {
    const seen = new Map();

    fullClientesData.forEach((cliente) => {
      const derivedValue = cliente._motivoOptionValue;
      const derivedLabel = cliente._resolvedMotivo || "Motivo no informado";
      let value = derivedValue;
      let label = derivedLabel;

      if (!value) {
        const codigo = toSafeString(
          cliente.resultadoEvaluacionCodigo ?? cliente.motivoRechazoCodigo ?? ""
        ).trim();
        const descripcionBase =
          cliente.resultadoEvaluacionDescripcion ||
          cliente.motivoRechazo ||
          (normalizeText(cliente.estado) === "aceptada"
            ? "Procesamiento satisfactorio"
            : "Motivo no informado");
        label = descripcionBase || "Motivo no informado";
        const normalizedDescripcion = normalizeText(label);
        const hasCodigo = codigo && !["", "null", "undefined"].includes(codigo.toLowerCase());
        value = hasCodigo ? codigo : normalizedDescripcion || label;
      }

      if (!seen.has(value)) {
        seen.set(value, label);
      }
    });

    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [fullClientesData]);

  const handleEstadoFilterChange = (event) => {
    const value = event.target.value;
    setEstadoFiltro(value);
    setPage(0);
  };

  const handleMotivoFilterChange = (event) => {
    const value = event.target.value;
    setMotivoFiltro(value);
    setPage(0);
  };

  const handleColumnFilterChange = (field) => (event) => {
    const value = event.target.value;
    const updatedFilters = {
      ...columnFilters,
      [field]: value,
    };
    setColumnFilters(updatedFilters);
    setPage(0);
  };

  useEffect(() => {
    if (
      motivoFiltro !== "todos" &&
      !motivoOptions.some((option) => option.value === motivoFiltro)
    ) {
      setMotivoFiltro("todos");
      setPage(0);
    }
  }, [motivoOptions, motivoFiltro, fullClientesData, estadoFiltro, sortMethod, columnFilters, busquedaGeneral]);

  useEffect(() => {
    let changed = false;
    const nextFilters = { ...columnFilters };

    if (columnFilters.cuil !== "todos" && !columnOptions.cuil.includes(columnFilters.cuil)) {
      nextFilters.cuil = "todos";
      changed = true;
    }
    if (columnFilters.nombre !== "todos" && !columnOptions.nombre.includes(columnFilters.nombre)) {
      nextFilters.nombre = "todos";
      changed = true;
    }
    if (columnFilters.apellido !== "todos" && !columnOptions.apellido.includes(columnFilters.apellido)) {
      nextFilters.apellido = "todos";
      changed = true;
    }
    if (columnFilters.telefono !== "todos" && !columnOptions.telefono.includes(columnFilters.telefono)) {
      nextFilters.telefono = "todos";
      changed = true;
    }
    if (columnFilters.email !== "todos" && !columnOptions.email.includes(columnFilters.email)) {
      nextFilters.email = "todos";
      changed = true;
    }
    if (
      columnFilters.tipoPrestamo !== "todos" &&
      !columnOptions.tipoPrestamo.includes(columnFilters.tipoPrestamo)
    ) {
      nextFilters.tipoPrestamo = "todos";
      changed = true;
    }
    if (columnFilters.fecha !== "todos" && !columnOptions.fecha.includes(columnFilters.fecha)) {
      nextFilters.fecha = "todos";
      changed = true;
    }

    if (changed) {
      setColumnFilters(nextFilters);
      setPage(0);
    }
  }, [columnOptions, columnFilters, fullClientesData, motivoFiltro, estadoFiltro, sortMethod, busquedaGeneral]);

  const getBcraSquareClass = (entry) => {
    if (entry?.loading) {
      return "bcra-status-square bcra-status-square--loading";
    }
    if (entry?.ok) {
      return "bcra-status-square bcra-status-square--up";
    }
    return "bcra-status-square bcra-status-square--down";
  };

  return (
    <div>
      <Banner />
    <div className="admin-background">
      <nav className="nav__container">
        <div className="innderNav">
          <div className="admin__title__card">
            <h2 className="admin__title">Nueva herramienta de Reportes</h2>
          </div>
        </div>
      </nav>
      <div className="main__container">
        <div className="bcra-status-bar">
          <div className="bcra-status-item">
            <span className="bcra-status-label">SERVIDOR ESTADO DE DEUDAS</span>
            <span
              className={getBcraSquareClass(bcraHealth.deudas)}
              title={
                bcraHealth.deudas.loading
                  ? "Verificando..."
                  : bcraHealth.deudas.ok
                  ? `Operativo${bcraHealth.deudas.status ? ` (HTTP ${bcraHealth.deudas.status})` : ""}`
                  : "Caído"
              }
            />
          </div>
          <div className="bcra-status-item">
            <span className="bcra-status-label">SERVIDOR ESTADO HISTÓRICO</span>
            <span
              className={getBcraSquareClass(bcraHealth.historico)}
              title={
                bcraHealth.historico.loading
                  ? "Verificando..."
                  : bcraHealth.historico.ok
                  ? `Operativo${bcraHealth.historico.status ? ` (HTTP ${bcraHealth.historico.status})` : ""}`
                  : "Caído"
              }
            />
          </div>
        </div>
        <div className="report-actions-bar">
          <button
            type="button"
            className="btn__bulk-delete"
            disabled={selectedCount === 0 || isBulkDeleting || isLoadingData}
            onClick={() => deleteSelected(Array.from(selectedIds))}
          >
            Eliminar seleccionados ({selectedCount})
          </button>
          <button
            type="button"
            className="btn__bulk-clear"
            disabled={selectedCount === 0 || isBulkDeleting || isLoadingData}
            onClick={clearSelection}
          >
            Limpiar selección
          </button>
        </div>
        <div className="filter__container">
          <h2>Filtro entradas por fecha</h2>
          <div className="input__container">
            <input
              className="input__field"
              type="date"
              value={startDate || ""}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span>-</span>
            <input
              className="input__field"
              type="date"
              value={endDate || ""}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <button className="btn__buscar" onClick={filterData}>
              Buscar
            </button>
          </div>
        </div>
        <div className="search__container">
          <input
            type="text"
            className="search__input"
            placeholder="Buscar por CUIL, teléfono, nombre, email..."
            value={busquedaGeneral}
            onChange={handleBusquedaChange}
          />
          {busquedaGeneral && (
            <button className="search__clear" type="button" onClick={handleClearBusqueda}>
              Limpiar
            </button>
          )}
        </div>
        <div className="search__hint">
          Buscando en los datos cargados; se ampliará al llegar más registros de fondo.
        </div>
        {isPurgingOld && (
          <div className="background-loading-hint">
            Eliminando registros anteriores a 3 meses antes de cargar datos…
          </div>
        )}
        {isPrefetchingOld && (
          <div className="background-loading-hint">
            Cargando registros antiguos en segundo plano...
          </div>
        )}
        {(isPrefetchingOld || isLoadingData) && (
          <div className="background-loading-hint" style={{ marginTop: "0.5rem" }}>
            La base de datos se está actualizando; los datos pueden cambiar mientras se completa la carga.
          </div>
        )}
        <div className="table__container">
          <div
            className="table__page-size-control"
            style={{
              marginBottom: "1rem",
              alignSelf: "flex-start",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <label className="table__page-size-label" htmlFor="page-size-select">
              Elementos por página
            </label>
            <select
              id="page-size-select"
              className="table__page-size-select"
              value={String(pageSize)}
              onChange={handlePageSizeChange}
            >
              {[10, 20, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <h6>Clickea en cada encabezado para ordenarlo por ese valor</h6>
          <div className="table__scroll">
            <table>
            <thead>
              <tr>
                <th>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Seleccionar todos en la página"
                    checked={isAllSelectedOnPage}
                    disabled={!pageIds.length || isBulkDeleting || isLoadingData}
                    onChange={(event) => {
                      event.stopPropagation();
                      toggleSelectAllOnPage();
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </th>
                <th onClick={sortByIdAscend}>
                  <div className="table__header-cell">
                    <span>ID</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.cuil}
                      onChange={handleColumnFilterChange("cuil")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.cuil.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByNombreAscend}>
                  <div className="table__header-cell">
                    <span>Nombre</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.nombre}
                      onChange={handleColumnFilterChange("nombre")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.nombre.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByApellidoAscend}>
                  <div className="table__header-cell">
                    <span>Apellido</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.apellido}
                      onChange={handleColumnFilterChange("apellido")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.apellido.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>
                  <div className="table__header-cell">
                    <span>Edad</span>
                  </div>
                </th>
                <th onClick={sortByTelefonoAscend}>
                  <div className="table__header-cell">
                    <span>Telefono</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.telefono}
                      onChange={handleColumnFilterChange("telefono")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.telefono.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByEmailAscend}>
                  <div className="table__header-cell">
                    <span>Email</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.email}
                      onChange={handleColumnFilterChange("email")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.email.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>
                  <div className="table__header-cell">
                    <span>Tipo prestamo</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.tipoPrestamo}
                      onChange={handleColumnFilterChange("tipoPrestamo")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.tipoPrestamo.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByFechaSolicitudDescend}>
                  <div className="table__header-cell">
                    <span>Fecha Solicitud</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.fecha}
                      onChange={handleColumnFilterChange("fecha")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todas</option>
                      {columnOptions.fecha.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>
                  <div className="table__header-cell">
                    <span>Solicitud aceptada</span>
                    <select
                      className="table__header-filter"
                      value={estadoFiltro}
                      onChange={handleEstadoFilterChange}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {estadoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th
                  title={BCRA_TOOLTIP_DEUDA_ACTUAL_VERIFICADA}
                  className="report__col-bcra-deuda-actual-verificada"
                >
                  <div className="table__header-cell">
                    <span>Deuda Actual Verificada</span>
                  </div>
                </th>
                <th
                  title={BCRA_TOOLTIP_DEUDA_HISTORICA_VERIFICADA}
                  className="report__col-bcra-deuda-historica-verificada"
                >
                  <div className="table__header-cell">
                    <span>Deuda Histórica Verificada</span>
                  </div>
                </th>
                <th>
                  <div className="table__header-cell">
                    <span>Motivo de rechazo</span>
                    <select
                      className="table__header-filter"
                      value={motivoFiltro}
                      onChange={handleMotivoFilterChange}
                      onClick={(event) => event.stopPropagation()}
                      disabled={motivoOptions.length === 0}
                    >
                      <option value="todos">Todos</option>
                      {motivoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>Borrar entrada</th>
              </tr>
            </thead>
            <tbody>
              {paginatedrecords.map((cliente, index) => {
                const estadoNormalizado = cliente._estadoNormalized || normalizeText(cliente.estado);
                const resultadoDescripcion = cliente._resolvedMotivo || "Motivo no informado";
                const rowId = cliente.id || null;
                const mostrarDetalle =
                  estadoNormalizado === "rechazada" &&
                  cliente.motivoRechazo &&
                  cliente.motivoRechazo !== resultadoDescripcion &&
                  !cliente._suppressMotivoDetalle;
                const fechaFormateada =
                  cliente._timestampLabelWithTime ||
                  formatDateTimeLabel(firebaseTimestampToDate(cliente.timestamp)) ||
                  "-";
                const edadVisible = Number.isFinite(cliente._edad) ? cliente._edad : "-";
                const telefonoVisible = cliente.telefono || "-";
                const emailVisible = cliente.email || "-";
                const tipoPrestamoVisible = cliente._tipoPrestamoLabel || "No especificado";
                const estadoVisible =
                  estadoNormalizado === "aceptada"
                    ? "Si"
                    : estadoNormalizado === "rechazada"
                    ? "No"
                    : "Pendiente";
                return (
                  <tr key={cliente.id || index}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar registro ${cliente.cuil || rowId || index}`}
                        checked={rowId ? selectedIds.has(rowId) : false}
                        disabled={!rowId || isBulkDeleting || isLoadingData}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleRowSelected(rowId);
                        }}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td>{cliente.cuil || "-"}</td>
                    <td>{cliente.nombre || "-"}</td>
                    <td>{cliente.apellido || "-"}</td>
                    <td>{edadVisible}</td>
                    <td>{telefonoVisible}</td>
                    <td>{emailVisible}</td>
                    <td>{tipoPrestamoVisible}</td>
                    <td>{fechaFormateada}</td>
                    <td>{estadoVisible}</td>
                    <td
                      title={BCRA_TOOLTIP_DEUDA_ACTUAL_VERIFICADA}
                      className="report__col-bcra-deuda-actual-verificada"
                    >
                      {cliente.bcraDeudaActualVerificada ? "Sí" : "No"}
                    </td>
                    <td
                      title={BCRA_TOOLTIP_DEUDA_HISTORICA_VERIFICADA}
                      className="report__col-bcra-deuda-historica-verificada"
                    >
                      {cliente.bcraDeudaHistoricaVerificada ? "Sí" : "No"}
                    </td>
                    <td
                      onClick={() => beginEditMotivo(cliente)}
                      style={{ cursor: savingMotivoId ? "default" : "pointer" }}
                    >
                      {editingMotivoId === cliente.id ? (
                        <select
                          className="table__header-filter"
                          value={editingMotivoValue}
                          disabled={savingMotivoId === cliente.id}
                          onChange={(event) => {
                            const value = event.target.value;
                            setEditingMotivoValue(value);
                            saveMotivoForCliente(cliente, value);
                          }}
                          onBlur={cancelEditMotivo}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <option value="" disabled>
                            Seleccionar...
                          </option>
                          {MOTIVO_EDIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <span>{resultadoDescripcion}</span>
                          {mostrarDetalle && (
                            <span className="table__motivo-detalle">{cliente.motivoRechazo}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(cliente.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}






            </tbody>
            </table>
          </div>
          <div className="pagination-container">
            <button
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              Pagina {page + 1} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => goToPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
        <button className="btn__export" onClick={toExport}>
          Exportar a CSV
        </button>
      </div>
    </div>
  </div>

  );
}
