import "../css/Verification.css";
import { useNavigate, useLocation } from "react-router-dom";
import React, { useState } from "react";
import Banner from "../components/Header";
import verificationImage from "../assets/verification.jpg";

function Paso2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto } = location.state || {};
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState("");

  const isAdult = (date) => {
    const birth = new Date(date);
    const today = new Date();
    let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) {
      months--;
    }
    return months >= 222; // 18 años y 6 meses
  };

  const handleNext = () => {
    if (!birthdate) {
      setError("La fecha de nacimiento es obligatoria");
      return;
    }
    if (!isAdult(birthdate)) {
      setError("Debes ser mayor de 18 años y 6 meses");
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
              <img className="verification__container__image_img" src={verificationImage} alt="verification" />
            </div>
          </div>
          <div className="verification__container__panel_right">
            <label htmlFor="birthdate">Fecha de nacimiento:</label>
            <input
              className="verification__input"
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
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
