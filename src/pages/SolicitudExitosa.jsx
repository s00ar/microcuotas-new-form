import "../css/Pasos.css";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

const normalizeName = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.toUpperCase() : "TU SOLICITUD";
};

function SolicitudExitosa() {
  const navigate = useNavigate();
  const location = useLocation();
  const { nombre } = location.state || {};
  const displayName = normalizeName(nombre);

  const handleNuevaSolicitud = () => {
    navigate("/");
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
            <h2 className="success-title">Listo! Registramos tu solicitud</h2>
            <p className="success-message">
              Muchas gracias {displayName}. En breve nos vamos a comunicar para continuar con el proceso.
            </p>
            <div className="verification__actions">
              <a href="https://microcuotas.com.ar/">
              <button className="verification__btn">
                Continuar
              </button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SolicitudExitosa;
