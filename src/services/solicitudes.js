import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";

export const RESULTADOS_EVALUACION = Object.freeze({
  MENOR_21: { codigo: 1, descripcion: "Rechazo por menor de 21 años." },
  DEMASIADOS_ACTIVOS: { codigo: 2, descripcion: "Rechazo por más de 5 productos activos." },
  MORA_ACTIVA: { codigo: 3, descripcion: "Rechazo por situación 2 de los activos." },
  HISTORIAL_SUPERIOR_DOS: {
    codigo: 4,
    descripcion: "Productos históricos supera situación 2 o no tiene prod. hist.",
  },
  APROBADO: {
    codigo: 5,
    descripcion: "Aprobado: ninguno de los prod. hist. supera la situación 2 o todos en situación 1.",
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

const clientesCollection = collection(db, "clientes");

const STRICT_UNIQUE_FIELDS = ["telefono", "email"];
const FIELDS_TO_NORMALIZE = ["cuil", "telefono", "email"];

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

export const isFieldUnique = async (field, value, options = {}) => {
  if (!field) {
    return true;
  }
  const normalizedValue = normalizeFieldValue(field, value);
  if (!normalizedValue) {
    return true;
  }

  const q = query(clientesCollection, where(field, "==", normalizedValue));
  const snapshot = await getDocs(q);
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
  const snapshot = await getDocs(q);
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
    return { canRegister: true, lastDate: null };
  }

  return { canRegister: latestDate <= cutoff, lastDate: latestDate };
};

export const isCuilRegistrable = async (cuilValue, windowDays = 30) => {
  const { canRegister } = await getCuilRecency(cuilValue, windowDays);
  return canRegister;
};

const ensureUniqueFields = async (payload) => {
  const duplicated = [];
  for (const field of STRICT_UNIQUE_FIELDS) {
    if (!(field in payload)) {
      continue;
    }
    const value = payload[field];
    if (!value) {
      continue;
    }
    const unique = await isFieldUnique(field, value, {
      ignoreEstados: ["rechazada"],
      sameCuilValue: payload.cuil ?? null,
    });
    if (!unique) {
      duplicated.push(field);
    }
  }
  if (duplicated.length) {
    const error = new Error("duplicate_fields");
    error.code = "duplicate_fields";
    error.fields = duplicated;
    throw error;
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
  const { skipUniqueValidation = false } = options;
  const sanitizedPayload = sanitizePayload(payload);
  if (!skipUniqueValidation) {
    await ensureUniqueFields(sanitizedPayload);
  }
  const docRef = await addDoc(clientesCollection, {
    ...sanitizedPayload,
    timestamp: serverTimestamp(),
  });
  return docRef;
};

export const saveRechazo = async ({
  motivoRechazo,
  motivoRechazoCodigo = "sin_codigo",
  resultadoEvaluacionCodigo = null,
  resultadoEvaluacionDescripcion = null,
  ...rest
}) => {
  const resultado =
    resultadoEvaluacionCodigo && resultadoEvaluacionDescripcion
      ? {
          codigo: resultadoEvaluacionCodigo,
          descripcion: resultadoEvaluacionDescripcion,
        }
      : mapReasonToResultado(motivoRechazoCodigo);

  return saveSolicitud(
    {
      estado: "rechazada",
      motivoRechazo: motivoRechazo || "Motivo no informado",
      motivoRechazoCodigo,
      resultadoEvaluacionCodigo: resultado?.codigo ?? null,
      resultadoEvaluacionDescripcion: resultado?.descripcion ?? null,
      ...rest,
    },
    { skipUniqueValidation: true }
  );
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

  return saveSolicitud({
    estado: "aceptada",
    motivoRechazo: null,
    motivoRechazoCodigo: null,
    resultadoEvaluacionCodigo: resultado.codigo,
    resultadoEvaluacionDescripcion: resultado.descripcion,
    ...payload,
  });
};

export default saveSolicitud;
