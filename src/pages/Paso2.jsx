import "../css/Pasos.css";
import { useNavigate, useLocation } from "react-router-dom";
import React, { useRef, useState } from "react";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";
import { saveRechazo, RESULTADOS_EVALUACION } from "../services/solicitudes";

const CONTACTO = "1142681704";
const MINIMUM_AGE_MONTHS = 18 * 12 + 6; // 18 años y 6 meses
const MINOR_ERROR_MESSAGE = `Debes ser mayor de 18 a\u00f1os y 6 meses para continuar. Comunicate al ${CONTACTO} si necesitas asistencia.`;

function Paso2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto } = location.state || {};
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState("");
  const rechazoRegistradoRef = useRef(false);

  const isAdult = (date) => {
    const birth = new Date(date);
    const today = new Date();
    let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) {
      months--;
    }
    return months >= MINIMUM_AGE_MONTHS;
  };

  const registrarRechazoEdad = async (fecha) => {
    if (rechazoRegistradoRef.current) {
      return;
    }
    rechazoRegistradoRef.current = true;
    try {
      const resultado = RESULTADOS_EVALUACION.MENOR_21;
      await saveRechazo({
        motivoRechazo: resultado.descripcion,
        motivoRechazoCodigo: "menor_21",
        resultadoEvaluacionCodigo: resultado.codigo,
        resultadoEvaluacionDescripcion: resultado.descripcion,
        cuotas: cuotas ?? null,
        monto: monto ?? null,
        fechaNacimiento: fecha || birthdate || null,
        origen: "paso2",
      });
    } catch (registroError) {
      console.error("Paso2 registrarRechazoEdad error", registroError);
    }
  };

  const handleBirthdateChange = (event) => {
    setBirthdate(event.target.value);
    setError("");
    rechazoRegistradoRef.current = false;
  };

  const handleNext = () => {
    if (!birthdate) {
      setError("La fecha de nacimiento es obligatoria");
      return;
    }
    if (!isAdult(birthdate)) {
      setError(MINOR_ERROR_MESSAGE);
      registrarRechazoEdad(birthdate);
      return;
    }
    navigate("/paso3", { state: { cuotas, monto, birthdate } });
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
            <label htmlFor="birthdate">Fecha de nacimiento:</label>
            <input
              className="verification__input"
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={handleBirthdateChange}
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
        <button className="verification__btn" onClick={handleNext}>
          Continuar
        </button>
      </div>
    </div>
  );
}

export default Paso2;
