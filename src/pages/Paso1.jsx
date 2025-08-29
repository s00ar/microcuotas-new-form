import "../css/Pasos.css";
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

function Paso1() {
  const navigate = useNavigate();
  const [cuotas, setCuotas] = useState("");
  const [monto, setMonto] = useState("");
  const [errorCuotas, setErrorCuotas] = useState("");
  const [errorMonto, setErrorMonto] = useState("");

  const handleCuotasChange = (e) => {
    const value = e.target.value;
    if (value === "") {
      setCuotas("");
      return;
    }
    const newValue = parseInt(value, 10);
    if (newValue >= 2 && newValue <= 12) {
      setCuotas(newValue.toString());
    }
  };

  const handleMontoChange = (e) => {
    const value = e.target.value;
    if (value === "") {
      setMonto("");
      return;
    }
    const newValue = parseInt(value, 10);
    if (newValue >= 100000 && newValue <= 500000) {
      setMonto(newValue.toString());
    }
  };

  const handleNext = () => {
    let valid = true;
    if (!monto) {
      setErrorMonto("El monto no puede estar en blanco");
      valid = false;
    } else {
      setErrorMonto("");
    }
    if (!cuotas) {
      setErrorCuotas("La cantidad de cuotas no puede estar en blanco");
      valid = false;
    } else {
      setErrorCuotas("");
    }
    if (!valid) {
      return;
    }
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
            <h2 htmlFor="cuotas">Cantidad de Cuotas:</h2>
            <input
              className="verification__input"
              id="cuotas"
              type="number"
              min="2"
              max="12"
              placeholder="Cantidad de cuotas"
              value={cuotas}
              onChange={handleCuotasChange}
            />
            {errorCuotas && (
              <div className="error-message_container">
                <div className="error-message_header">Error</div>
                <div className="error-message_body">{errorCuotas}</div>
              </div>
            )}
            <h2 htmlFor="monto">Monto Solicitado:</h2>
            <input
              className="verification__input"
              id="monto"
              type="number"
              min="100000"
              max="500000"
              step="5000"
              placeholder="Monto solicitado"
              value={monto}
              onChange={handleMontoChange}
            />
            {errorMonto && (
              <div className="error-message_container">
                <div className="error-message_header">Error</div>
                <div className="error-message_body">{errorMonto}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="btn__container">
        <button className="verification__btn" onClick={handleNext}>
          Solicitar crédito
        </button>
      </div>
    </div>
  );
}

export default Paso1;
