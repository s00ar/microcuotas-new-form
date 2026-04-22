import "../css/Pasos.css";
import { useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

const CONTACTO = "11 4268 1704";
const MINIMUM_AGE_MONTHS = 30 * 12; // 30 años
const MINOR_ERROR_MESSAGE = `Debes ser mayor de 30 años para continuar. Comunicate al telefono de linea ${CONTACTO} si necesitas asistencia.`;

function Paso2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto } = location.state || {};
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cuotas === undefined || monto === undefined) {
      navigate("/paso1", { replace: true });
    }
  }, [cuotas, monto, navigate]);

  const isAdult = (date) => {
    const birth = new Date(date);
    const today = new Date();
    let months =
      (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) {
      months--;
    }
    return months >= MINIMUM_AGE_MONTHS;
  };

  const handleBirthdateChange = (event) => {
    setBirthdate(event.target.value);
    setError("");
  };

  const handleNext = () => {
    if (!birthdate) {
      setError("La fecha de nacimiento es obligatoria");
      return;
    }
    if (!isAdult(birthdate)) {
      setError(MINOR_ERROR_MESSAGE);
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
            <div className="spacer">
              <h2>Fecha de nacimiento:</h2>
              <label className="sr-only" htmlFor="birthdate">
                Fecha de nacimiento
              </label>
              <input
                className="verification__input"
                id="birthdate"
                type="date"
                aria-label="Fecha de nacimiento"
                value={birthdate}
                onChange={handleBirthdateChange}
              />
            </div>
            {error && (
              <div className="error-message_container">
                <div className="error-message_header">Error</div>
                <div className="error-message_body">{error}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="btn__spacer" />
      <div className="btn__container">
        <button className="verification__btn" onClick={handleNext}>
          Continuar
        </button>
      </div>
    </div>
  );
}

export default Paso2;
