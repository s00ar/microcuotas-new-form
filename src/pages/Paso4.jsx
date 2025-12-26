import "../css/Pasos.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";
import { FaCheckSquare } from "react-icons/fa";
import { saveRechazo, mapReasonToResultado, validateTarjetaContact } from "../services/solicitudes";
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

const buildPeriod = (periodo, entidades) => ({
  periodo,
  entidades: entidades.map(({ entidad, situacion }) => ({
    entidad,
    situacion,
  })),
});

const rejectionMessages = {
  tooManyActive:
    "Lamentablemente no podemos continuar porque segun el BCRA registra muchos productos activos. Si podemos ofrecerle un prestamo personal a traves de su tarjeta de crédito, en caso que usted tenga disponible o cupo en su tarjeta. Ingrese a continuacion, si le interesa, su numero de celular junto con su correo electronico y un representante de MicroCuotas se pondra en contacto con usted.",
  activeMora:
    "Lamentablemente no podemos continuar porque segun el BCRA registra mora activa con alguna entidad. Si podemos ofrecerle un prestamo personal a traves de su tarjeta de crédito, en caso que usted tenga disponible o cupo en su tarjeta. Ingrese a continuacion, si le interesa, su numero de celular junto con su correo electronico y un representante de MicroCuotas se pondra en contacto con usted.",
  historicalMora:
    "Lamentablemente no podemos continuar porque segun el BCRA se registran atrasos recientes. Si podemos ofrecerle un prestamo personal a traves de su tarjeta de crédito, en caso que usted tenga disponible o cupo en su tarjeta. Ingrese a continuacion, si le interesa, su numero de celular junto con su correo electronico y un representante de MicroCuotas se pondra en contacto con usted.",
  missingData:
    "No pudimos validar la informacion del BCRA. Reintente la consulta o verifique el CUIL/CUIT. Ante cualquier duda llame al teléfono de linea 11 4268 1704 de L a V de 9.30 a 17.30 hs y Sabados de 9.30 a 13 hs.",
  noProducts:
    "No pudimos continuar porque el BCRA no reporta productos historicos a tu nombre. Verifica el CUIL/CUIT o comunicate con nosotros para seguir la gestion.",
};

const rejectionContactReasons = new Set(["bcra_mora_activa", "bcra_demasiados_activos", "bcra_mora_historica"]);

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

const normalizeSituacionValue = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object") {
    if (value === null) {
      return 0;
    }
    if ("codigo" in value) {
      return normalizeSituacionValue(value.codigo);
    }
    if ("code" in value) {
      return normalizeSituacionValue(value.code);
    }
    if ("valor" in value) {
      return normalizeSituacionValue(value.valor);
    }
    if ("value" in value) {
      return normalizeSituacionValue(value.value);
    }
  }
  return 0;
};

const normalizeEntities = (period) => (Array.isArray(period?.entidades) ? period.entidades.filter(Boolean) : []);

export const evaluateBcraEligibility = (bcraData, bcraHistoricalData, messages = rejectionMessages) => {
  const effectiveHistorical = bcraHistoricalData || bcraData;
  if (!bcraData && !bcraHistoricalData) {
    return { ok: false, message: messages.missingData, reason: "bcra_sin_datos" };
  }

  const periodos = Array.isArray(bcraData?.periodos) ? [...bcraData.periodos] : [];
  periodos.sort((a, b) => normalizePeriodValue(b?.periodo) - normalizePeriodValue(a?.periodo));
  const [activePeriod] = periodos;
  const activeEntities = activePeriod ? normalizeEntities(activePeriod) : [];

  if (activeEntities.length >= 5) {
    return { ok: false, message: messages.tooManyActive, reason: "bcra_demasiados_activos" };
  }

  const hasActiveMorosos = activeEntities.some((entity) => {
    const situacion = normalizeSituacionValue(entity?.situacion);
    return situacion >= 2;
  });
  if (hasActiveMorosos) {
    return { ok: false, message: messages.activeMora, reason: "bcra_mora_activa" };
  }

  const historicalPeriods = Array.isArray(effectiveHistorical?.periodos) ? effectiveHistorical.periodos : [];
  const historicalEntities = historicalPeriods.flatMap((period) => normalizeEntities(period));
  if (!historicalEntities.length && !activeEntities.length) {
    console.warn("Paso4.evaluateBcraEligibility sin historicos en BCRA", effectiveHistorical);
    return { ok: false, message: messages.noProducts, reason: "bcra_sin_productos" };
  }

  const hasHistoricalMorosos = historicalEntities.some((entity) => {
    const situacion = normalizeSituacionValue(entity?.situacion);
    return situacion > 2;
  });
  if (hasHistoricalMorosos) {
    return { ok: false, message: messages.historicalMora, reason: "bcra_mora_historica" };
  }

  return { ok: true };
};

export const BCRA_TEST_CUILS = Object.freeze({
  APROBADO: "20303948091",
  DEMASIADOS_ACTIVOS: "20303948092",
  MORA_ACTIVA: "20303948093",
  SIN_PRODUCTOS: "20303948094",
  HISTORIAL_MORA: "20303948095",
  SIN_DATOS: "20303948096",
  API_404: "20303948097",
  API_500: "20303948098",
  RESPUESTA_SIN_NOMBRE: "20303948099",
  RESPUESTA_INVALIDA: "20303948100",
});

const MOCK_BCRA_RESPONSES = Object.freeze({
  [BCRA_TEST_CUILS.APROBADO]: {
    results: {
      identificacion: 20303948091,
      denominacion: "CLIENTE DE PRUEBA",
      periodos: [
        buildPeriod("202507", [
          { entidad: "BANCO DE LA CIUDAD DE BUENOS AIRES", situacion: 1 },
          { entidad: "MERCADOLIBRE S.R.L.", situacion: 1 },
        ]),
        buildPeriod("202506", [
          { entidad: "RECUPERO DE ACTIVOS FIDEICOMISO FINANCIERO", situacion: 1 },
        ]),
      ],
    },
  },
  [BCRA_TEST_CUILS.DEMASIADOS_ACTIVOS]: {
    results: {
      identificacion: 20303948092,
      denominacion: "BCRA TEST DEMASIADOS ACTIVOS",
      periodos: [
        buildPeriod("202507", [
          { entidad: "BANCO 1", situacion: 1 },
          { entidad: "BANCO 2", situacion: 1 },
          { entidad: "BANCO 3", situacion: 1 },
          { entidad: "BANCO 4", situacion: 1 },
          { entidad: "BANCO 5", situacion: 1 },
          { entidad: "BANCO 6", situacion: 1 },
        ]),
      ],
    },
  },
  [BCRA_TEST_CUILS.MORA_ACTIVA]: {
    results: {
      identificacion: 20303948093,
      denominacion: "BCRA TEST MORA ACTIVA",
      periodos: [
        buildPeriod("202507", [
          { entidad: "BANCO MOROSO", situacion: 3 },
          { entidad: "BANCO NORMAL", situacion: 1 },
        ]),
        buildPeriod("202506", [
          { entidad: "BANCO HISTORICO", situacion: 1 },
        ]),
      ],
    },
  },
  [BCRA_TEST_CUILS.SIN_PRODUCTOS]: {
    results: {
      identificacion: 20303948094,
      denominacion: "BCRA TEST SIN PRODUCTOS",
      periodos: [],
    },
  },
  [BCRA_TEST_CUILS.HISTORIAL_MORA]: {
    results: {
      identificacion: 20303948095,
      denominacion: "BCRA TEST HISTORICO",
      periodos: [
        buildPeriod("202507", [
          { entidad: "BANCO ACTUAL", situacion: 1 },
        ]),
        buildPeriod("202506", [
          { entidad: "BANCO HISTORICO", situacion: 3 },
        ]),
      ],
    },
  },
  [BCRA_TEST_CUILS.SIN_DATOS]: {
    error: "Simulamos un error genérico en la consulta al BCRA para este CUIL de prueba.",
  },
  [BCRA_TEST_CUILS.API_404]: {
    error: "Simulamos un error 404 del servicio del BCRA.",
    status: 404,
  },
  [BCRA_TEST_CUILS.API_500]: {
    error: "Simulamos un error interno (500) del servicio del BCRA.",
    status: 500,
  },
  [BCRA_TEST_CUILS.RESPUESTA_SIN_NOMBRE]: {
    results: {
      identificacion: 20303948099,
      denominacion: "",
      periodos: [
        buildPeriod("202507", [
          { entidad: "BANCO SIN NOMBRE", situacion: 1 },
        ]),
      ],
    },
  },
  [BCRA_TEST_CUILS.RESPUESTA_INVALIDA]: null,
});

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
  const [bcraHistoricalData, setBcraHistoricalData] = useState(null);
  const [rejectionPrompt, setRejectionPrompt] = useState(null);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isContactValidating, setIsContactValidating] = useState(false);
  const rejectionPersistedRef = useRef(false);
  const rejectionLockRef = useRef(0);
  useGlobalLoadingEffect(isLoading);

  const formattedDate = useMemo(() => formatDate(birthdate), [birthdate]);
  const formattedCuil = useMemo(() => formatCuil(cuil), [cuil]);
  const finalName = useMemo(() => (personName || manualName || "").trim(), [personName, manualName]);
  const contactPhoneDigits = useMemo(() => String(contactPhone || "").replace(/\D/g, ""), [contactPhone]);

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

    const requestBcraPayload = async (url) => {
      const response = await fetch(url, {
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
      return typeof payload === "object" && payload !== null && "results" in payload
        ? payload.results
        : payload;
    };

    const fetchData = async () => {
      setIsLoading(true);
      setError("");
      setBcraData(null);
      setBcraHistoricalData(null);
      setPersonName("");

      try {
        const mockScenario = MOCK_BCRA_RESPONSES[cuil];
        if (mockScenario !== undefined) {
          if (mockScenario && typeof mockScenario === "object" && "error" in mockScenario) {
            const errorMessage = mockScenario.error || "Error en la consulta simulada al BCRA.";
            const status = mockScenario.status;
            const err = new Error(errorMessage);
            err.status = status;
            err.mockMessage = errorMessage;
            throw err;
          }

          const normalizedResults =
            typeof mockScenario === "object" && mockScenario !== null && "results" in mockScenario
              ? mockScenario.results
              : mockScenario;
          const normalizedHistory =
            typeof mockScenario === "object" && mockScenario !== null && "historicalResults" in mockScenario
              ? mockScenario.historicalResults
              : normalizedResults;
          const name = extractName(normalizedResults);
          const normalized = String(name || "").trim();
          if (!normalized) {
            const err = new Error("Respuesta sin nombre");
            err.mockMessage = "La respuesta simulada no trae denominacion.";
            throw err;
          }
          if (isMounted) {
            setBcraData(normalizedResults);
            setBcraHistoricalData(normalizedHistory);
            setPersonName(normalized.toUpperCase());
          }
          return;
        }

        const endpointActual = `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuil}`;
        const endpointHistorico = `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/Historicas/${cuil}`;

        let normalizedResults = null;
        let historicalResults = null;
        let actualError = null;

        try {
          normalizedResults = await requestBcraPayload(endpointActual);
        } catch (err) {
          // No frenamos: seguimos con historico aunque el endpoint actual falle
          actualError = err;
          console.warn("Paso4 BCRA actual fallo, continuo con historico", err?.payload || err?.message);
          normalizedResults = null;
        }

        try {
          historicalResults = await requestBcraPayload(endpointHistorico);
        } catch (errHistorico) {
          // Solo propagamos si tampoco tenemos datos del endpoint actual
          if (!normalizedResults) {
            throw errHistorico;
          }
        }

        if (!normalizedResults && !historicalResults) {
          throw actualError || new Error("Sin datos de BCRA");
        }

        // Si no hay datos en la consulta actual, usamos el historico como fuente principal para nombre y periodos
        const primaryResults =
          (normalizedResults && Array.isArray(normalizedResults?.periodos) && normalizedResults.periodos.length
            ? normalizedResults
            : null) || historicalResults || normalizedResults;

        const name = extractName(primaryResults || historicalResults || normalizedResults);
        const normalizedName = String(name || "").trim();
        if (!normalizedName) {
          if (isMounted) {
            setBcraData(primaryResults || normalizedResults || historicalResults);
            setBcraHistoricalData(historicalResults || primaryResults || normalizedResults);
            setPersonName("");
            setManualName("");
            setError("No pudimos obtener tu nombre desde BCRA, ingresalo manualmente para continuar.");
          }
          return;
        }
        if (isMounted) {
          setBcraData(primaryResults || normalizedResults || historicalResults);
          setBcraHistoricalData(historicalResults || primaryResults || normalizedResults);
          setPersonName(normalizedName.toUpperCase());
          if (actualError) {
            setError("");
          }
        }
      } catch (err) {
        console.error("Paso4 BCRA fetch error", err);
        if (isMounted) {
          setBcraData(null);
          setBcraHistoricalData(null);
          setPersonName("");
          const statusInfo = err?.status ? ` (estado ${err.status})` : "";
          if (err?.mockMessage) {
            setError(`${err.mockMessage}${statusInfo}`);
          } else {
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

  const shouldCollectContact = (reason) => rejectionContactReasons.has(reason);

  const isValidContactPhone = (value) => contactPhoneDigits.length === 10;
  const isValidContactEmail = (value) => {
    const normalized = String(value || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
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
        bcraHistorico: bcraHistoricalData || null,
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


  const resetRejectionPrompt = () => {
    setRejectionPrompt(null);
    setContactPhone("");
    setContactEmail("");
  };

  const openRejectionPrompt = (evaluation) => {
    setRejectionPrompt(evaluation);
    setContactPhone("");
    setContactEmail("");
    rejectionPersistedRef.current = false;
  };

  const persistCurrentRejection = async (extra = {}, origen = "paso4_confirmacion") => {
    if (!rejectionPrompt || rejectionPersistedRef.current) {
      return;
    }
    await persistRejection(
      rejectionPrompt.message,
      rejectionPrompt.reason,
      origen,
      { evaluacion: rejectionPrompt, ...extra }
    );
    rejectionPersistedRef.current = true;
  };

  const handleRejectionClose = async () => {
    await persistCurrentRejection();
    resetRejectionPrompt();
  };

  const handleRejectionContactSubmit = async () => {
    if (isContactValidating || !isValidContactPhone(contactPhone) || !isValidContactEmail(contactEmail)) {
      return;
    }
    setIsContactValidating(true);
    try {
      const validation = await validateTarjetaContact({
        teléfono: contactPhoneDigits,
        email: contactEmail,
        nombreCompleto: finalName,
      });

      if (!validation.ok) {
        const conflictMessages = [];
        if (validation.conflictos.length) {
          const fieldsText =
            validation.conflictos.length === 2
              ? "El celular y el correo"
              : validation.conflictos[0] === "teléfono"
              ? "El celular"
              : "El correo";
          conflictMessages.push(
            `${fieldsText} ya figura asociado a otra persona. Ingresalo nuevamente o usa otro dato de contacto.`
          );
        }
        if (validation.recientes.length) {
          const fieldsText =
            validation.recientes.length === 2
              ? "El celular y el correo"
              : validation.recientes[0] === "teléfono"
              ? "El celular"
              : "El correo";
          conflictMessages.push(
            `${fieldsText} fueron cargados en los ultimos 30 dias. Ingresa datos distintos para continuar.`
          );
        }
        window.alert(conflictMessages.join(" "));
        setIsContactValidating(false);
        return;
      }

      await persistCurrentRejection(
        {
          teléfono: contactPhoneDigits || null,
          email: contactEmail.trim() || null,
          tipoPrestamo: "tarjeta",
        },
        "paso4_contacto"
      );
      window.alert("Enviamos tus datos de contacto. Un representante te contactara a la brevedad.");
      resetRejectionPrompt();
    } catch (err) {
      console.error("Paso4 contacto tarjeta error", err);
      window.alert("No pudimos validar los datos de contacto. Intentalo nuevamente.");
    } finally {
      setIsContactValidating(false);
    }
  };

  const handleConfirm = async () => {
    const evaluation = evaluateBcraEligibility(bcraData, bcraHistoricalData, rejectionMessages);
    if (!evaluation.ok) {
      openRejectionPrompt(evaluation);
      if (!shouldCollectContact(evaluation.reason)) {
        await persistRejection(evaluation.message, evaluation.reason, "paso4_confirmacion", {
          evaluacion: evaluation,
        });
        rejectionPersistedRef.current = true;
      }
      return;
    }

    navigate("/paso5", {
      state: { cuil, cuotas, monto, birthdate, nombre: finalName, bcraData, bcraHistorico: bcraHistoricalData },
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
  const contactInfoInvalid =
    isContactValidating || !isValidContactPhone(contactPhone) || !isValidContactEmail(contactEmail);

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
          <div className="spacer__cuil">
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
                  ¿Usted es: <span className="verification__highlight">{finalName.toUpperCase()}</span> ?
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
      {rejectionPrompt && (
        <div
        className="rejection-modal"
        style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1000,
          }}
          >
          <div
            className="rejection-modal__content"
            style={{
              background: "#ffffff",
              maxWidth: "560px",
              width: "100%",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
            }}
            >
            <p style={{ marginBottom: shouldCollectContact(rejectionPrompt.reason) ? "14px" : "10px" }}>
              {rejectionPrompt.message}
            </p>
            {shouldCollectContact(rejectionPrompt.reason) && (
              <>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Celular:</label>
                <input
                  type="tel"
                  className="verification__input"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="Ej: 11 2345 6789"
                  style={{ marginBottom: "12px" }}
                  />
                {contactPhone && !isValidContactPhone(contactPhone) && (
                  <p style={{ color: "#b00020", marginTop: "-6px", marginBottom: "10px", fontSize: "0.9rem" }}>
                    El celular debe tener exactamente 10 numeros.
                  </p>
                )}
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Correo:</label>
                <input
                  type="email"
                  className="verification__input"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="correo@ejemplo.com"
                  />
                {contactEmail && !isValidContactEmail(contactEmail) && (
                  <p style={{ color: "#b00020", marginTop: "1px", marginBottom: "10px", fontSize: "0.9rem" }}>
                    Ingrese un correo valido (ej: nombre@dominio.com).
                  </p>
                )}
              </>
            )}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "18px" }}>
              {shouldCollectContact(rejectionPrompt.reason) && (
                <button
                type="button"
                className="verification__btn"
                onClick={handleRejectionContactSubmit}
                disabled={contactInfoInvalid}
                >
                  Enviar
                </button>
              )}
              <button type="button" className="verification__btn verification__btn--small" onClick={handleRejectionClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Paso4;
