import "../css/Pasos.css";
import { useNavigate, useLocation } from "react-router-dom";
import React, { useState } from "react";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

function Paso3() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto, birthdate } = location.state || {};
  const [cuil, setCuil] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const checkBcraStatus = async () => {
    setIsLoading(true);
    try {
      if (!cuil) {
        setError("CUIL/CUIT no puede estar en blanco");
        return;
      }
      if (cuil.length !== 11) {
        setError("Ingresa un CUIL/CUIT válido");
        return;
      }
      

      const response = await fetch(`https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuil}`);
      if (response.ok) {
        navigate("/clientform", { state: { cuil, cuotas, monto, birthdate } });
      } else {
        setError("No fue posible verificar su situación en BCRA");
      }
    } catch (e) {
      setError("Ocurrió un error al verificar en BCRA");
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
            <h2>Por favor ingresa tu cuil/cuit</h2>
            <input
              className="verification__input"
              type="text"
              placeholder="Ingresa tu cuil"
              onChange={(e) => setCuil(e.target.value)}
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
        <button className="verification__btn" onClick={checkBcraStatus} disabled={isLoading}>
          {isLoading ? <span className="spinner">Cargando...</span> : "Continuar"}
        </button>
      </div>
    </div>
  );
}

export default Paso3;
