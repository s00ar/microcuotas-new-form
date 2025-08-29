import "../css/Verification.css";
import { useNavigate, useLocation } from "react-router-dom";
import React, { useState } from "react";
import Banner from "../components/Header";
import verificationImage from "../assets/verification.jpg";
import { db } from "../firebase";
import { collection, query, where, limit, getDocs } from "firebase/firestore";

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

      const treintaDiasMs = 30 * 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - treintaDiasMs);

      const qRef = query(
        collection(db, "clientes"),
        where("cuil", "==", cuil),
        where("timestamp", ">", cutoff),
        limit(1)
      );
      const snap = await getDocs(qRef);
      const recentRequest = !snap.empty;

      if (recentRequest) {
        setError(
          "El CUIL ya fue registrado en los últimos 30 días. Solamente se puede ingresar una solicitud cada 30 días."
        );
      } else {
        setError("");
        const response = await fetch(`https://api.bcra.gob.ar/centraldeudores/porcuil/${cuil}`);
        if (response.ok) {
          navigate("/clientform", { state: { cuil, cuotas, monto, birthdate } });
        } else {
          setError("No fue posible verificar su situación en BCRA");
        }
      }
    } catch (error) {
      console.error("Error checking CUIL availability:", error);
      const msg =
        error?.code === "permission-denied"
          ? "No autorizado para leer datos. Vuelve a intentar."
          : error?.code === "resource-exhausted"
          ? "Se agotó el cupo de Firestore. Intenta más tarde."
          : "Ocurrió un error al verificar el CUIL.";
      setError(msg);
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
              <img className="verification__container__image_img" src={verificationImage} alt="verification" />
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
