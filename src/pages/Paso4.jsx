import "../css/Pasos.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";
import { FaCheckSquare } from "react-icons/fa";
import { saveRechazo, mapReasonToResultado } from "../services/solicitudes";
import { useGlobalLoadingEffect } from "../components/GlobalLoadingProvider";

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string" && value.includes("-")) {
    const parts = value.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = String(date.getFullYear());
      return `${day}-${month}-${year}`;
    }
  } catch (err) {
    console.warn("Paso4.formatDate error", err);
  }
  return String(value);
};

const formatCuil = (value) => {
  if (!value) {
    return "";
  }
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.length !== 11) {
    return String(value);
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

const extractName = (payload) => {
  if (!payload) {
    return "";
  }
  if (typeof payload === "string") {
    return payload;
  }
  if (payload.denominacion) {
    return payload.denominacion;
  }
  if (payload.results?.denominacion) {
    return payload.results.denominacion;
  }
  if (payload.nombre && payload.apellido) {
    return `${payload.nombre} ${payload.apellido}`.trim();
  }
  if (payload.nombre) {
    return payload.nombre;
  }
  if (payload.apellido) {
    return payload.apellido;
  }
  if (Array.isArray(payload.personas) && payload.personas.length > 0) {
    return extractName(payload.personas[0]);
  }
  if (payload.persona) {
    return extractName(payload.persona);
  }
  if (payload.resultado) {
    return extractName(payload.resultado);
  }
  return "";
};

function Paso4() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuil, cuotas, monto, birthdate } = location.state || {};
  const [personName, setPersonName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [manualName, setManualName] = useState("");
  const [bcraData, setBcraData] = useState(null);
  const rejectionLockRef = useRef(0);
  useGlobalLoadingEffect(isLoading);

  const formattedDate = useMemo(() => formatDate(birthdate), [birthdate]);
  const formattedCuil = useMemo(() => formatCuil(cuil), [cuil]);
  const finalName = useMemo(() => (personName || manualName || "").trim(), [personName, manualName]);

  useEffect(() => {
    if (personName) {
      setManualName("");
    }
  }, [personName]);

  useEffect(() => {
    if (!cuil) {
      navigate("/paso3", { replace: true });
    }
  }, [cuil, navigate]);

  useEffect(() => {
    if (!cuil) {
      return;
    }
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      setError("");

      if (cuil === "20303948091") {
        const mockPayload = {
          status: 200,
          results: {
            identificacion: 20303948091,
            denominacion: "CLIENTE DE PRUEBA",
            periodos: [
              {
                periodo: "202507",
                entidades: [
                  { entidad: "BANCO DE LA CIUDAD DE BUENOS AIRES", situacion: 1 },
                  { entidad: "MERCADOLIBRE S.R.L.", situacion: 1 }
                ],
              },
              {
                periodo: "202506",
                entidades: [
                  { entidad: "RECUPERO DE ACTIVOS FIDEICOMISO FINANCIERO", situacion: 1 },
                ],
              },
            ],
          },
        };
        const normalizedResults = mockPayload.results;
        const name = extractName(normalizedResults);
        const normalized = String(name || "").trim();
        setBcraData(normalizedResults);
        setPersonName(normalized.toUpperCase());
        setIsLoading(false);
        return;
      }

      try {
        const endpoint = `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuil}`;
        const response = await fetch(endpoint, {
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
        });
        const bodyText = await response.text();
        let payload = null;
        try {
          payload = bodyText ? JSON.parse(bodyText) : null;
        } catch (jsonErr) {
          payload = bodyText;
        }
        if (!response.ok) {
          const err = new Error(`BCRA status ${response.status}`);
          err.status = response.status;
          err.payload = payload;
          throw err;
        }
        const apiStatus =
          typeof payload === "object" && payload !== null && "status" in payload
            ? Number(payload.status)
            : null;
        if (apiStatus && apiStatus !== 200) {
          const err = new Error(`BCRA status ${apiStatus}`);
          err.status = apiStatus;
          err.payload = payload;
          throw err;
        }
        const normalizedResults =
          typeof payload === "object" && payload !== null && "results" in payload
            ? payload.results
            : payload;
        const name = extractName(normalizedResults);
        const normalized = String(name || "").trim();
        if (!normalized) {
          throw new Error("Respuesta sin nombre");
        }
        if (isMounted) {
          setBcraData(normalizedResults);
          setPersonName(normalized.toUpperCase());
        }
      } catch (err) {
        console.error("Paso4 BCRA fetch error", err);
        if (isMounted) {
          setBcraData(null);
          setPersonName("");
          const statusInfo = err?.status ? ` (estado ${err.status})` : "";
          const detailMessage =
            err?.message &&
            err.message !== `BCRA status ${err?.status ?? ""}` &&
            err.message !== "Failed to fetch"
              ? ` Detalle: ${err.message}`
              : "";
          setError(
            `No pudimos obtener tu nombre desde BCRA${statusInfo}. Reintenta o verifica el CUIL.${detailMessage}`
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [cuil, reloadToken]);

  const handleRetry = () => {
    if (!isLoading) {
      setReloadToken((value) => value + 1);
    }
  };

  const rejectionMessages = {
  tooManyActive:
    "Lamentablemente no podemos continuar porque segun el BCRA registras muchos productos activos. Intentalo nuevamente cuando hayas reducido la cantidad de productos.",
  activeMora:
    "Lamentablemente no podemos continuar porque segun el BCRA registras mora activa con alguna entidad. Regulariza la situacion y volve a intentarlo.",
  historicalMora:
    "Lamentablemente no podemos continuar porque segun el BCRA se registran atrasos recientes. Volve a intentarlo cuando tu historial lo permita.",
  missingData:
    "No pudimos validar la informacion del BCRA. Reintenta la consulta o verifica el CUIL/CUIT.",
  noProducts:
    "Listo! No encontramos productos a tu nombre. Un asesor se comunicara con vos para continuar. Tambien podes escribirnos o llamarnos al 1142681704.",
};


  const persistRejection = async (motivo, motivoCodigo, origen = "paso4", extra = {}) => {
    if (!motivo || !cuil) {
      return;
    }
    const now = Date.now();
    if (rejectionLockRef.current && now - rejectionLockRef.current < 1500) {
      return;
    }
    rejectionLockRef.current = now;
    try {
      const {
        resultadoEvaluacionCodigo: extraResultadoCodigo,
        resultadoEvaluacionDescripcion: extraResultadoDescripcion,
        ...restExtra
      } = extra || {};
      const resultadoMapeado = mapReasonToResultado(motivoCodigo);
      await saveRechazo({
        motivoRechazo: motivo,
        motivoRechazoCodigo: motivoCodigo || "sin_codigo",
        cuil,
        cuotas: cuotas ?? null,
        monto: monto ?? null,
        fechaNacimiento: birthdate || null,
        nombre: finalName || null,
        nombreCompleto: finalName || null,
        bcra: bcraData || null,
        origen,
        resultadoEvaluacionCodigo: extraResultadoCodigo ?? resultadoMapeado?.codigo ?? null,
        resultadoEvaluacionDescripcion:
          extraResultadoDescripcion ?? resultadoMapeado?.descripcion ?? null,
        ...restExtra,
      });
    } catch (persistErr) {
      console.error("Paso4 persistRechazo error", persistErr);
    }
  };

  const normalizePeriodValue = (value) => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const evaluateBcraEligibility = () => {
    if (!bcraData) {
      return { ok: false, message: rejectionMessages.missingData, reason: "bcra_sin_datos" };
    }

    const periodos = Array.isArray(bcraData?.periodos) ? [...bcraData.periodos] : [];
    if (!periodos.length) {
      return { ok: false, message: rejectionMessages.noProducts, reason: "bcra_sin_productos" };
    }

    periodos.sort((a, b) => normalizePeriodValue(b?.periodo) - normalizePeriodValue(a?.periodo));
    const normalizeEntities = (period) =>
      Array.isArray(period?.entidades) ? period.entidades.filter(Boolean) : [];

    const [activePeriod, ...restPeriods] = periodos;
    const activeEntities = normalizeEntities(activePeriod);
    const historicalEntities = restPeriods.flatMap((period) => normalizeEntities(period));

    if (activeEntities.length > 5) {
      return { ok: false, message: rejectionMessages.tooManyActive, reason: "bcra_demasiados_activos" };
    }

    if (activeEntities.length > 0) {
      const hasActiveMorosos = activeEntities.some((entity) => {
        const situacion = Number(entity?.situacion ?? 0);
        return situacion >= 2;
      });
      if (hasActiveMorosos) {
        return { ok: false, message: rejectionMessages.activeMora, reason: "bcra_mora_activa" };
      }
    } else {
      if (!historicalEntities.length) {
        return { ok: false, message: rejectionMessages.noProducts, reason: "bcra_sin_productos" };
      }
      const allHistoricalSituacionUno = historicalEntities.every((entity) => {
        const situacion = Number(entity?.situacion ?? 0);
        return situacion <= 1;
      });
      if (!allHistoricalSituacionUno) {
        return { ok: false, message: rejectionMessages.historicalMora, reason: "bcra_mora_historica" };
      }
      return { ok: true };
    }

    if (!historicalEntities.length) {
      return { ok: true };
    }

    const hasHistoricalAboveTwo = historicalEntities.some((entity) => {
      const situacion = Number(entity?.situacion ?? 0);
      return situacion > 2;
    });
    if (hasHistoricalAboveTwo) {
      return { ok: false, message: rejectionMessages.historicalMora, reason: "bcra_mora_historica" };
    }

    return { ok: true };
  };


  const handleConfirm = async () => {
    const evaluation = evaluateBcraEligibility();
    if (!evaluation.ok) {
      await persistRejection(evaluation.message, evaluation.reason, "paso4_confirmacion", { evaluacion: evaluation });
      window.alert(evaluation.message);
      return;
    }

    navigate("/paso5", {
      state: { cuil, cuotas, monto, birthdate, nombre: finalName, bcraData },
    });
  };

  const handleReject = async () => {
    await persistRejection(
      "El usuario indico que no es la persona validada.",
      "identidad_no_confirmada",
      "paso4_usuario_rechazo"
    );

    navigate("/rechazo-nombre", {
      state: { cuil, cuotas, monto, birthdate, nombre: finalName },
    });
  };

  const disableConfirm = !finalName || isLoading;

  return (
    <div>
      <div className="banner__container">
        <Banner />
      </div>
      <div className="verification__container">
        <div className="verification__container__panel">
          <div className="verification__container__panel_left">
            <div className="verification__container__image_img-container">
              <LottieAnim width={600} height={600} />
            </div>
          </div>
          <div className="verification__container__panel_right">
            <div className="verification__details">
              <div className="verification__details-row">
                <span className="verification__details-label">
                  Fecha de Nacimiento (DD/MM/AAAA):
                </span>
                <span className="verification__details-value">
                  {formattedDate || "--"}
                </span>
                <FaCheckSquare className="verification__details-icon" />
              </div>
              <div className="verification__details-row">
                <span className="verification__details-label">CUIL o CUIT:</span>
                <span className="verification__details-value">
                  {formattedCuil || "--"}
                </span>
                <FaCheckSquare className="verification__details-icon" />
              </div>
            </div>

            <div className="verification__question-block">
              {isLoading && (
                <p className="verification__status-text">Consultando datos en BCRA...</p>
              )}
              {!isLoading && error && (
                <div className="error-message_container">
                  <div className="error-message_header">Aviso</div>
                  <div className="error-message_body">
                    <p>{error}</p>
                    <button
                      type="button"
                      className="verification__btn verification__btn--small"
                      onClick={handleRetry}
                    >
                      Reintentar
                    </button>
                    <p className="verification__manual-caption">Ingresa tu nombre si deseas continuar:</p>
                    <input
                      type="text"
                      className="verification__input verification__manual-input"
                      value={manualName}
                      onChange={(event) => setManualName(event.target.value)}
                      placeholder="Nombre y apellido"
                    />
                  </div>
                </div>
              )}
              {!isLoading && finalName && (
                <h2 className="verification__question">
                  Usted es <span className="verification__highlight">{finalName.toUpperCase()}</span> ?
                </h2>
              )}
            </div>

            <div className="verification__actions">
              <button
                className="verification__btn"
                onClick={handleConfirm}
                disabled={disableConfirm}
              >
                Si, soy yo
              </button>
              <button className="verification__btn" onClick={handleReject}>
                No
              </button>
              {!isLoading && !personName && !error && (
                <p className="verification__status-text">Esperando datos de BCRA...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Paso4;





