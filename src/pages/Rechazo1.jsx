import "../css/Pasos.css";
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

function Rechazo1() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto, birthdate, nombre } = location.state || {};

  const handleModify = () => {
    navigate("/paso3", { state: { cuotas, monto, birthdate } });
  };

  const handleRestart = () => {
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
            <p>
              Si usted no es <strong>{nombre}</strong> ...
            </p>
            <div className="btn__container">
              <button className="verification__btn" onClick={handleModify}>
                Modificar
              </button>
              <button className="verification__btn" onClick={handleRestart}>
                Reiniciar
              </button>
            </div>
            <div className="error-message_container">
              <div className="error-message_body">
                Verifique bien su Cuit o Cuil y vuelva a Cargarlo.
                <br />
                Muchas Gracias.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Rechazo1;
