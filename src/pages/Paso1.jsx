import "../css/Pasos.css";
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

function Paso1() {
  const navigate = useNavigate();
  const [cuotas, setCuotas] = useState("12");
  const [monto, setMonto] = useState(500000);

  const handleCuotasChange = (e) => {
    const newValue = parseInt(e.target.value);
    if (newValue >= 2 && newValue <= 12) {
      setCuotas(newValue);
    }
  };

  const handleMontoChange = (e) => {
    const newValue = parseInt(e.target.value);
    if (newValue >= 100000 && newValue <= 500000) {
      setMonto(newValue);
    }
  };

  const handleNext = () => {
    navigate("/paso2", { state: { cuotas, monto } });
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
            <h2 htmlFor="monto">Monto Solicitado:</h2>
            <input
              className="verification__input"
              id="monto"
              type="range"
              min="100000"
              max="500000"
              step="5000"
              value={monto}
              onChange={handleMontoChange}
              />
              <span>{`Monto: $${monto}`}</span>
            <h2 htmlFor="cuotas">Cantidad de Cuotas:</h2>
            <input
              className="verification__input"
              id="cuotas"
              type="range"
              min="2"
              max="12"
              value={cuotas}
              onChange={handleCuotasChange}
              />
              <span>{`Cantidad de cuotas: ${cuotas}`}</span>
          </div>
        </div>
      </div>
      <div className="btn__container">
        <button className="verification__btn" onClick={handleNext}>
          Solicitar crédito
        </button>
      </div>
      <p className="version-text">v3.7.2</p>
    </div>
  );
}

export default Paso1;
