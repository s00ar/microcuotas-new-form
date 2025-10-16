import "../css/Pasos.css";
import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

const formatName = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.toUpperCase() : "la persona indicada";
};

function RechazoNombre() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuil, cuotas, monto, birthdate, nombre } = location.state || {};
  const displayName = useMemo(() => formatName(nombre), [nombre]);

  const handleModificar = () => {
    navigate("/paso3", { state: { cuil, cuotas, monto, birthdate } });
  };

  const handleReiniciar = () => {
    navigate("/paso1");
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
            <h2 className="rejection-title">
              Si usted no es <span className="verification__highlight">{displayName}</span> ...
            </h2>
            <div className="verification__actions">
              <button className="verification__btn" onClick={handleModificar}>
                Modificar
              </button>
              <button className="verification__btn" onClick={handleReiniciar}>
                Reiniciar
              </button>
            </div>
            <div className="rejection-message">
              <p>Verifique bien su Cuil o Cuit y vuelva a cargarlo</p>
              <p>Muchas Gracias.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RechazoNombre;
