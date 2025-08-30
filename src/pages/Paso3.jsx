// src/pages/Paso3.jsx
import "../css/Pasos.css";
import { useNavigate, useLocation } from "react-router-dom";
import React, { useState } from "react";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";

// Firestore
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  setLogLevel,
} from "firebase/firestore";

setLogLevel?.("debug"); // logs verbosos

function Paso3() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto, birthdate } = location.state || {};
  const [cuil, setCuil] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const db = getFirestore();

  const checkStatus = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError("");

    console.groupCollapsed("Paso3.checkStatus");
    try {
      // Validación básica
      const cuilClean = (cuil || "").replace(/\D/g, "");
      if (!cuilClean) {
        setError("CUIL/CUIT no puede estar en blanco");
        return;
      }
      if (!/^\d{11}$/.test(cuilClean)) {
        setError("Ingresa un CUIL/CUIT válido");
        return;
      }

      // Ventana de 30 días
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Consulta solo por CUIL en 'clientes' (sin índice compuesto)
      const qRef = query(
        collection(db, "clientes"),
        where("cuil", "==", String(cuilClean))
      );

      console.time("Firestore:getDocs");
      const snap = await getDocs(qRef);
      console.timeEnd("Firestore:getDocs");
      console.log("Firestore snapshot:", { empty: snap.empty, size: snap.size });

      // Filtra en cliente por timestamp > cutoffDate
      const tieneReciente = snap.docs.some((d) => {
        const ts = d.data()?.timestamp;
        const dt = ts?.toDate?.() ?? null;
        return dt && dt > cutoffDate;
      });

      if (tieneReciente) {
        setError(
          "El CUIL ya fue registrado en los últimos 30 días. Solo se permite una solicitud cada 30 días."
        );
        return;
      }

      // OK: avanzar al formulario
      navigate("/clientform", { state: { cuil: cuilClean, cuotas, monto, birthdate } });
    } catch (e) {
      console.error("Excepción en checkStatus", e);
      setError("Ocurrió un error al verificar el CUIL. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
      console.groupEnd();
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
              onChange={(e) => setCuil(e.target.value.trim())}
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
        <button
          className="verification__btn"
          onClick={checkStatus}
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner">Cargando...</span> : "Continuar"}
        </button>
      </div>
    </div>
  );
}

export default Paso3;
