// src/pages/Paso3.jsx
import "../css/Pasos.css";
import { useNavigate, useLocation } from "react-router-dom";
import React, { useState } from "react";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";
import { getCuilRecency } from "../services/solicitudes";

const CONTACTO = "1142681704";
const TEST_CUIL = "20303948091";
const WINDOW_DIAS_REINGRESO = 30;

function Paso3() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto, birthdate, cuil: initialCuil } = location.state || {};
  const [cuil, setCuil] = useState(initialCuil || "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = async () => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const cuilClean = (cuil || "").replace(/\D/g, "");
      if (!cuilClean) {
        setError("CUIL/CUIT no puede estar en blanco");
        return;
      }
      if (!/^\d{11}$/.test(cuilClean)) {
        setError("Ingresa un CUIL/CUIT valido");
        return;
      }

      if (cuilClean !== TEST_CUIL) {
        try {
          const { canRegister, lastDate } = await getCuilRecency(cuilClean, WINDOW_DIAS_REINGRESO);
          if (!canRegister) {
            const ultimaFecha =
              lastDate instanceof Date ? lastDate.toLocaleDateString("es-AR") : "los ultimos 30 dias";
            setError(
              `El CUIL ingresado ya se registro en los ultimos ${WINDOW_DIAS_REINGRESO} dias (ultima carga ${ultimaFecha}). Comunicate al ${CONTACTO} para continuar con la gestion.`
            );
            return;
          }
        } catch (recencyError) {
          console.warn("Paso3 getCuilRecency fallback", recencyError);
          if (
            recencyError?.code === "permission-denied" ||
            recencyError?.code === "failed-precondition" ||
            recencyError?.code === "unauthenticated"
          ) {
            // Sin permisos en Firestore: permitimos continuar con la simulacion local.
          } else {
            throw recencyError;
          }
        }
      }

      navigate("/paso4", { state: { cuil: cuilClean, cuotas, monto, birthdate } });
    } catch (error) {
      console.error("Excepcion en checkStatus", error);
      const message =
        error?.message && typeof error.message === "string"
          ? error.message
          : "Ocurrio un error al verificar el CUIL. Intenta de nuevo.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

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
            <h2>Por favor ingresa tu CUIL/CUIT</h2>
            <input
              className="verification__input"
              type="text"
              placeholder="Ingresa tu CUIL"
              value={cuil}
              onChange={(event) => setCuil(event.target.value.trim())}
            />

            {error && (
              <div className="error-message_container">
                <div className="error-message_header">Error</div>
                <div className="error-message_body">{error}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="btn__container">
        <button className="verification__btn" onClick={checkStatus} disabled={isLoading}>
          {isLoading ? <span className="spinner">Cargando...</span> : "Continuar"}
        </button>
      </div>
    </div>
  );
}

export default Paso3;
