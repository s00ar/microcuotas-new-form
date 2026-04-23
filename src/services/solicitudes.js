import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { auth, db } from "../firebase";

export const RESULTADOS_EVALUACION = Object.freeze({
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

const RESULTADO_POR_MOTIVO = {
  menor_21: RESULTADOS_EVALUACION.MENOR_21,
  bcra_demasiados_activos: RESULTADOS_EVALUACION.DEMASIADOS_ACTIVOS,
  bcra_mora_activa: RESULTADOS_EVALUACION.MORA_ACTIVA,
  bcra_mora_historica: RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS,
  bcra_sin_productos: RESULTADOS_EVALUACION.HISTORIAL_SUPERIOR_DOS,
};

export const mapReasonToResultado = (motivoCodigo) => {
  if (!motivoCodigo) {
    return null;
  }
  return RESULTADO_POR_MOTIVO[motivoCodigo] || null;
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isAgeRejection = ({
  motivoRechazoCodigo,
  resultadoEvaluacionCodigo,
  resultadoEvaluacionDescripcion,
  motivoRechazo,
}) => {
  const normalizedCodigo = normalizeText(motivoRechazoCodigo);
  const normalizedResultadoCodigo = normalizeText(resultadoEvaluacionCodigo);
  if (normalizedCodigo === "menor_21" || normalizedCodigo === "1") {
    return true;
  }
  if (normalizedResultadoCodigo === "1") {
    return true;
  }
  const normalizedDescripcion = normalizeText(
    resultadoEvaluacionDescripcion || motivoRechazo || ""
  );
  return normalizedDescripcion.includes("menor de 30");
};

const clientesCollection = collection(db, "clientes");

const STRICT_UNIQUE_FIELDS = [
  { name: "telefono", ignoreEstados: ["rechazada"], allowSameCuil: true },
  { name: "email", ignoreEstados: ["rechazada"], allowSameCuil: true },
  { name: "cuil", ignoreEstados: [], allowSameCuil: false },
];
const FIELDS_TO_NORMALIZE = ["cuil", "telefono", "email"];

let ensureAuthPromise = null;
export const ensureFirestoreAuth = async () => {
  if (!auth) {
    return null;
  }
  if (auth.currentUser) {
    return auth.currentUser;
  }
  if (!ensureAuthPromise) {
    ensureAuthPromise = signInAnonymously(auth)
      .then((cred) => cred?.user ?? null)
      .catch((error) => {
        console.warn("No se pudo autenticar anonimamente contra Firestore", error);
        return null;
      })
      .finally(() => {
        ensureAuthPromise = null;
      });
  }
  return ensureAuthPromise;
};

const runWithAuthRetry = async (operation) => {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureFirestoreAuth();
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (isPermissionDeniedError(error) && attempt === 0) {
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const isPermissionDeniedError = (error) => {
  if (!error) {
    return false;
  }
  if (error.code === "permission-denied") {
    return true;
  }
  const message = typeof error.message === "string" ? error.message : "";
  return message.toLowerCase().includes("missing or insufficient permissions");
};

export const normalizeFieldValue = (field, value) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (field === "email") {
    return String(value).trim().toLowerCase();
  }
  if (field === "cuil" || field === "telefono") {
    return String(value).replace(/\D/g, "");
  }
  return String(value).trim();
};

const getDateFromTimestamp = (timestamp) => {
  if (!timestamp) {
    return null;
  }
  if (timestamp instanceof Date) {
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  }
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp === "object") {
    if (typeof timestamp.toDate === "function") {
      try {
        const date = timestamp.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      } catch (err) {
        return null;
      }
    }
    if (typeof timestamp.seconds === "number") {
      const milliseconds = timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1_000_000;
      return new Date(milliseconds);
    }
  }
  return null;
};

const normalizeNameValue = (value) => {
  if (!value) {
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
};

const extractNombreCompleto = (data = {}) => {
  if (data.nombreCompleto) {
    return data.nombreCompleto;
  }
  const nombre = data.nombre || "";
  const apellido = data.apellido || "";
  const combined = `${nombre} ${apellido}`.trim();
  if (combined) {
    return combined;
  }
  return nombre || apellido || "";
};

export const isFieldUnique = async (field, value, options = {}) => {
  if (!field) {
    return true;
  }
  const normalizedValue = normalizeFieldValue(field, value);
  if (!normalizedValue) {
    return true;
  }

  const q = query(clientesCollection, where(field, "==", normalizedValue));
  let snapshot;
  try {
    snapshot = await runWithAuthRetry(() => getDocs(q));
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn(
        "isFieldUnique: omito la validación porque Firestore denegó los permisos de lectura."
      );
      return true;
    }
    throw error;
  }
  if (snapshot.empty) {
    return true;
  }

  const ignoreEstados = Array.isArray(options.ignoreEstados) ? options.ignoreEstados : [];
  const estadosToIgnore = ignoreEstados.map((estado) => String(estado).toLowerCase());
  const sameCuil = options.sameCuilValue ? normalizeFieldValue("cuil", options.sameCuilValue) : null;

  const shouldIgnoreEstado = (estado) => {
    if (estado === undefined || estado === null) {
      return false;
    }
    const normalized = String(estado).toLowerCase();
    return estadosToIgnore.includes(normalized);
  };

  const remaining = snapshot.docs.filter((docSnap) => {
    const data = docSnap.data() || {};
    if (shouldIgnoreEstado(data.estado ?? null)) {
      return false;
    }
    if (sameCuil) {
      const docCuil = normalizeFieldValue("cuil", data.cuil);
      if (docCuil && docCuil === sameCuil) {
        return false;
      }
    }
    return true;
  });

  return remaining.length === 0;
};

export const getCuilRecency = async (cuilValue, windowDays = 30) => {
  const normalized = normalizeFieldValue("cuil", cuilValue);
  if (!normalized) {
    return { canRegister: true, lastDate: null };
  }

  const q = query(clientesCollection, where("cuil", "==", normalized));
  let snapshot;
  try {
    snapshot = await runWithAuthRetry(() => getDocs(q));
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn(
        "getCuilRecency: no se pudo consultar Firestore por permisos insuficientes; permito continuar."
      );
      return { canRegister: true, lastDate: null };
    }
    throw error;
  }
  if (snapshot.empty) {
    return { canRegister: true, lastDate: null };
  }

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  let latestDate = null;
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const ts = getDateFromTimestamp(data.timestamp) || getDateFromTimestamp(data.fechaSolicitud);
    if (ts && (!latestDate || ts > latestDate)) {
      latestDate = ts;
    }
  });

  if (!latestDate) {
    // If there are documents but no valid timestamp information, treat the CUIL as non-registrable.
    // This prevents duplicate CUIL entries from slipping through when existing records lack timestamp fields.
    return { canRegister: false, lastDate: null };
  }

  return { canRegister: latestDate <= cutoff, lastDate: latestDate };
};

export const isCuilRegistrable = async (cuilValue, windowDays = 30) => {
  const { canRegister } = await getCuilRecency(cuilValue, windowDays);
  return canRegister;
};

export const getFieldUsageDetails = async (field, value, options = {}) => {
  if (!field) {
    return {
      hasNameConflict: false,
      isRecent: false,
      lastDate: null,
      normalizedValue: "",
      normalizedNames: [],
    };
  }
  const normalizedValue = normalizeFieldValue(field, value);
  if (!normalizedValue) {
    return {
      hasNameConflict: false,
      isRecent: false,
      lastDate: null,
      normalizedValue: "",
      normalizedNames: [],
    };
  }

  const q = query(clientesCollection, where(field, "==", normalizedValue));
  let snapshot;
  try {
    snapshot = await runWithAuthRetry(() => getDocs(q));
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn(
        "getFieldUsageDetails: omito la validacion porque Firestore denego permisos de lectura."
      );
      return {
        hasNameConflict: false,
        isRecent: false,
        lastDate: null,
        normalizedValue,
        normalizedNames: [],
      };
    }
    throw error;
  }

  if (snapshot.empty) {
    return {
      hasNameConflict: false,
      isRecent: false,
      lastDate: null,
      normalizedValue,
      normalizedNames: [],
    };
  }

  const windowDays = typeof options.windowDays === "number" ? options.windowDays : 30;
  const referenceName = normalizeNameValue(options.referenceName || "");
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  let latestDate = null;
  const namesSet = new Set();

  snapshot.docs.forEach((docSnap) => {
    const data = (typeof docSnap.data === "function" ? docSnap.data() : docSnap.data) || {};
    const docName = normalizeNameValue(extractNombreCompleto(data));
    if (docName) {
      namesSet.add(docName);
    }
    const ts = getDateFromTimestamp(data.timestamp) || getDateFromTimestamp(data.fechaSolicitud);
    if (ts && (!latestDate || ts > latestDate)) {
      latestDate = ts;
    }
  });

  const hasNameConflict =
    referenceName &&
    Array.from(namesSet).some((storedName) => storedName && storedName !== referenceName);
  const isRecent = latestDate ? latestDate > cutoff : false;

  return {
    hasNameConflict,
    isRecent,
    lastDate: latestDate,
    normalizedValue,
    normalizedNames: Array.from(namesSet),
  };
};

export const validateTarjetaContact = async (
  { telefono, email, nombreCompleto, cuil },
  windowDays = 30
) => {
  const referenceName = normalizeNameValue(nombreCompleto);
  const normalizedCuil = normalizeFieldValue("cuil", cuil);
  const telefonoInfo = await getFieldUsageDetails("telefono", telefono, {
    windowDays,
    referenceName,
  });
  const emailInfo = await getFieldUsageDetails("email", email, { windowDays, referenceName });

  const conflicts = [];
  const recent = [];
  const duplicates = [];

  if (telefonoInfo.hasNameConflict) {
    conflicts.push("telefono");
  }
  if (emailInfo.hasNameConflict) {
    conflicts.push("email");
  }
  if (telefonoInfo.isRecent) {
    recent.push("telefono");
  }
  if (emailInfo.isRecent) {
    recent.push("email");
  }

  const [telefonoUnico, emailUnico] = await Promise.all([
    isFieldUnique("telefono", telefono, { ignoreEstados: [] }),
    isFieldUnique("email", email, { ignoreEstados: [] }),
  ]);

  const [cuilUnico, cuilRegistrable] = normalizedCuil
    ? await Promise.all([
        isFieldUnique("cuil", normalizedCuil, { ignoreEstados: [] }),
        isCuilRegistrable(normalizedCuil, windowDays),
      ])
    : [true, true];

  if (!telefonoUnico) {
    duplicates.push("telefono");
  }
  if (!emailUnico) {
    duplicates.push("email");
  }
  if (!cuilUnico) {
    duplicates.push("cuil");
  }
  if (!cuilRegistrable) {
    recent.push("cuil");
  }

  return {
    ok: conflicts.length === 0 && recent.length === 0 && duplicates.length === 0,
    conflictos: conflicts,
    recientes: recent,
    duplicados: duplicates,
    telefonoInfo,
    emailInfo,
  };
};

const ensureUniqueFields = async (payload, windowDays = 30) => {
  const duplicated = [];
  for (const fieldRules of STRICT_UNIQUE_FIELDS) {
    const { name, ignoreEstados = [], allowSameCuil = false } = fieldRules;
    if (!(name in payload)) {
      continue;
    }
    const value = payload[name];
    if (!value) {
      continue;
    }
    const unique = await isFieldUnique(name, value, {
      ignoreEstados,
      sameCuilValue: allowSameCuil ? payload.cuil ?? null : null,
    });
    if (!unique) {
      duplicated.push(name);
    }
  }
  if (duplicated.length) {
    const error = new Error("duplicate_fields");
    error.code = "duplicate_fields";
    error.fields = duplicated;
    throw error;
  }

  if (payload?.cuil) {
    const { canRegister } = await getCuilRecency(payload.cuil, windowDays);
    if (!canRegister) {
      const error = new Error("duplicate_fields");
      error.code = "duplicate_fields";
      error.fields = ["cuil"];
      throw error;
    }
  }
};

const sanitizePayload = (payload) => {
  const sanitized = { ...payload };
  FIELDS_TO_NORMALIZE.forEach((field) => {
    if (field in sanitized) {
      const normalized = normalizeFieldValue(field, sanitized[field]);
      sanitized[field] = normalized || null;
    }
  });
  return sanitized;
};

const saveSolicitud = async (payload, options = {}) => {
  const { skipUniqueValidation = false, windowDays = 30 } = options;
  const sanitizedPayload = sanitizePayload(payload);
  if (!skipUniqueValidation) {
    await ensureUniqueFields(sanitizedPayload, windowDays);
  }
  const docRef = await runWithAuthRetry(() =>
    addDoc(clientesCollection, {
      ...sanitizedPayload,
      timestamp: serverTimestamp(),
    })
  );
  return docRef;
};

export const saveRechazo = async ({
  motivoRechazo,
  motivoRechazoCodigo = "sin_codigo",
  resultadoEvaluacionCodigo = null,
  resultadoEvaluacionDescripcion = null,
  ...rest
}) => {
  const resolvedMotivoCodigo = motivoRechazoCodigo || "sin_codigo";
  const resultado =
    resultadoEvaluacionCodigo && resultadoEvaluacionDescripcion
      ? {
          codigo: resultadoEvaluacionCodigo,
          descripcion: resultadoEvaluacionDescripcion,
        }
      : mapReasonToResultado(resolvedMotivoCodigo);

  const resultadoCodigo = resultado?.codigo ?? resultadoEvaluacionCodigo ?? null;
  const resultadoDescripcion = resultado?.descripcion ?? resultadoEvaluacionDescripcion ?? null;
  if (
    isAgeRejection({
      motivoRechazoCodigo: resolvedMotivoCodigo,
      resultadoEvaluacionCodigo: resultadoCodigo,
      resultadoEvaluacionDescripcion: resultadoDescripcion,
      motivoRechazo,
    })
  ) {
    return null;
  }

  return saveSolicitud(
    {
      estado: "rechazada",
      motivoRechazo: motivoRechazo || "Motivo no informado",
      motivoRechazoCodigo: resolvedMotivoCodigo,
      resultadoEvaluacionCodigo: resultadoCodigo,
      resultadoEvaluacionDescripcion: resultadoDescripcion,
      ...rest,
    },
    { skipUniqueValidation: false }
  );
};

export const savePendiente = async ({
  bcraDeudaActualVerificada = false,
  bcraDeudaHistoricaVerificada = false,
  bcraNoVerificado = false,
  resultadoEvaluacionCodigo = null,
  resultadoEvaluacionDescripcion = null,
  ...payload
}) => {
  const resolvedPayload = {
    estado: "pendiente",
    bcraDeudaActualVerificada: Boolean(bcraDeudaActualVerificada),
    bcraDeudaHistoricaVerificada: Boolean(bcraDeudaHistoricaVerificada),
    bcraNoVerificado: Boolean(bcraNoVerificado),
    resultadoEvaluacionCodigo,
    resultadoEvaluacionDescripcion,
    ...payload,
  };
  return saveSolicitud(resolvedPayload, { skipUniqueValidation: false });
};

export const saveAceptada = async ({
  resultadoEvaluacionCodigo,
  resultadoEvaluacionDescripcion,
  ...payload
}) => {
  const resultado =
    resultadoEvaluacionCodigo && resultadoEvaluacionDescripcion
      ? {
          codigo: resultadoEvaluacionCodigo,
          descripcion: resultadoEvaluacionDescripcion,
        }
      : RESULTADOS_EVALUACION.APROBADO;
  const tipoPrestamo = payload.tipoPrestamo || "personal";

  return saveSolicitud({
    estado: "aceptada",
    motivoRechazo: null,
    motivoRechazoCodigo: null,
    resultadoEvaluacionCodigo: resultado.codigo,
    resultadoEvaluacionDescripcion: resultado.descripcion,
    tipoPrestamo,
    ...payload,
  });
};

export default saveSolicitud;
