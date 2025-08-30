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
  limit,
  orderBy,
  Timestamp,
  setLogLevel,
} from "firebase/firestore";

setLogLevel?.("debug"); // activa logs verbosos de Firestore

function Paso3() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuotas, monto, birthdate } = location.state || {};
  const [cuil, setCuil] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const db = getFirestore();

  const checkBcraStatus = async () => {
    setIsLoading(true);
    setError("");

    console.groupCollapsed("Paso3.checkBcraStatus");
    console.log("Inputs:", { cuil, cuotas, monto, birthdate, online: navigator.onLine });

    try {
      // 0) Validaciones básicas
      if (!cuil) {
        setError("CUIL/CUIT no puede estar en blanco");
        console.warn("Validación: cuil vacío");
        return;
      }
      if (!/^\d{11}$/.test(cuil)) {
        setError("Ingresa un CUIL/CUIT válido");
        console.warn("Validación: formato inválido", { length: cuil.length, value: cuil });
        return;
      }

      // 1) Gate de Firestore: 30 días
      const treintaDiasMs = 30 * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - treintaDiasMs);
      const cutoffTs = Timestamp.fromDate(cutoffDate);
      console.log("Firestore cutoff:", { cutoffDate: cutoffDate.toISOString(), cutoffTs });

      const qRef = query(
        collection(db, "solicitudes"),
        where("cuil", "==", cuil),
        where("timestamp", ">", cutoffTs),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      console.time("Firestore:getDocs");
      const snap = await getDocs(qRef);
      console.timeEnd("Firestore:getDocs");
      console.log("Firestore snapshot:", { empty: snap.empty, size: snap.size });

      if (!snap.empty) {
        const doc = snap.docs[0];
        // log seguro: muestra solo campos clave
        const data = doc.data?.() ?? {};
        console.warn("Solicitud reciente encontrada", {
          id: doc.id,
          cuil: data.cuil,
          timestamp: data.timestamp?.toDate?.()?.toISOString?.(),
        });

        setError(
          "El CUIL ya fue registrado en los últimos 30 días. Solamente se puede ingresar una solicitud cada 30 días."
        );
        return;
      }

      // 2) BCRA
      const url = `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuil}`;
      console.time("BCRA:fetch");
      const response = await fetch(url, { method: "GET" }).catch((err) => {
        console.error("Fetch error antes de recibir respuesta", err);
        throw err;
      });
      console.timeEnd("BCRA:fetch");
      console.log("BCRA response:", { ok: response.ok, status: response.status, url: response.url });

      if (response.ok) {
        console.log("BCRA OK. Navegando a /clientform");
        navigate("/clientform", { state: { cuil, cuotas, monto, birthdate } });
      } else {
        setError("No fue posible verificar su situación en BCRA");
        const text = await response.text().catch(() => "");
        console.error("BCRA no OK", { status: response.status, body: text?.slice?.(0, 500) });
      }
    } catch (e) {
      console.error("Excepción en checkBcraStatus", {
        name: e?.name,
        code: e?.code,
        message: e?.message,
        stack: e?.stack,
      });
      const msg =
        e?.code === "permission-denied"
          ? "No autorizado para leer datos. Vuelve a intentar."
          : e?.code === "resource-exhausted"
          ? "Se agotó el cupo de Firestore. Intenta más tarde."
          : "Ocurrió un error al verificar el CUIL/BCRA.";
      setError(msg);
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
        <button className="verification__btn" onClick={checkBcraStatus} disabled={isLoading}>
          {isLoading ? <span className="spinner">Cargando...</span> : "Continuar"}
        </button>
      </div>
    </div>
  );
}

export default Paso3;
