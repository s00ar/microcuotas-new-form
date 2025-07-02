import "../css/Verification.css";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { query, collection, getDocs, where } from "firebase/firestore";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";
import { subscribeToSimulationParams } from "../firebase";

function Verification(props) {
  const navigate = useNavigate();
  const [cuil, setCuil] = useState("");
  const [cuilError, setCuilError] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [monto, setMonto] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Estado para el spinner

  // ⚡ Estado para guardar los valores mínimos y máximos traídos desde Firebase
  const [simParams, setSimParams] = useState({
    minCuotas: 2,
    maxCuotas: 12,
    minMonto: 50000,
    maxMonto: 500000,
  });

  // ⚡ Suscribirse a cambios en Firestore al montar el componente
  useEffect(() => {
    const unsubscribe = subscribeToSimulationParams(
      params => {
        setSimParams({
          minCuotas: params.minCuotas,
          maxCuotas: params.maxCuotas,
          minMonto: params.minMonto,
          maxMonto: params.maxMonto,
        });
        // Opcional: ajustar valores actuales si quedaron fuera de rango
        setCuotas(prev => {
          const v = prev || params.maxCuotas;
          return Math.min(Math.max(v, params.minCuotas), params.maxCuotas);
        });
        setMonto(prev => {
          const v = prev || params.minMonto;
          return Math.min(Math.max(v, params.minMonto), params.maxMonto);
        });
      },
      err => console.error("Error simul Params:", err)
    );
    return () => unsubscribe();
  }, []);

  // Mantén este useEffect para leer query params sólo la primera vez
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCuotas = urlParams.get("cuotas");
    const urlMonto = urlParams.get("monto");

    if (!cuotas) {
      setCuotas('12');
    }

    if (urlCuotas) {
      setCuotas(urlCuotas);
    }
    if (urlMonto) {
      setMonto(urlMonto);
    }
  }, []);

  const checkCuilAvailability = async () => {
    setIsLoading(true); // Muestra el spinner al hacer clic en el botón
    try {
      if (!cuil) {
        setCuilError("CUIL no puede estar en blanco");
        setIsLoading(false);
        return;
      }
      if (!monto) {
        setCuilError("El monto no puede estar en blanco");
        setIsLoading(false);
        return;
      }
      if (!cuotas) {
        setCuilError("La cantidad de cuotas no puede estar en blanco");
        setIsLoading(false);
        return;
      }

      if (cuil.length !== 11) {
        setCuilError("Ingresa un CUIL válido");
        setIsLoading(false);
        return;
      }

      const q = query(collection(db, 'clientes'), where('cuil', '==', cuil));
      const querySnapshot = await getDocs(q);

      let recentRequest = false;

      querySnapshot.forEach((doc) => {
        const timestampData = doc.data().timestamp;
        const timestamp = timestampData ? timestampData.toDate() : null;

        if (timestamp) {
          const last30Days = 30 * 24 * 60 * 60 * 1000;
          if (Date.now() - timestamp.getTime() < last30Days) {
            recentRequest = true;
          }
        } else {
          console.error('Timestamp is undefined for document with CUIL:', cuil);
        }
      });

      if (recentRequest) {
        setCuilError("El CUIL ya fue registrado en los últimos 30 días. Solamente se puede ingresar una solicitud cada 30 días.");
      } else {
        setCuilError("");
        navigate("/clientform", { state: { cuil, cuotas, monto } });
      }
    } catch (error) {
      console.error('Error checking CUIL availability:', error);
      setCuilError("Ocurrió un error al verificar el CUIL. Inténtelo de nuevo más tarde.");
    } finally {
      setIsLoading(false); // Oculta el spinner al finalizar el proceso
    }
  };

  // ⚡ Manejo de cambio usando los rangos dinámicos
  const handleCuotasChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    if (newValue >= simParams.minCuotas && newValue <= simParams.maxCuotas) {
      setCuotas(newValue);
    }
  };

  const handleMontoChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    if (newValue >= simParams.minMonto && newValue <= simParams.maxMonto) {
      setMonto(newValue);
    }
  };

  const closeError = () => {
    setCuilError("");
    window.location.reload();
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
              <LottieAnim
                width={600}
                height={600}
              />
            </div>
          </div>
          <div className="verification__container__panel_right">
            <h2>Por favor ingresa tu cuil</h2>
            <input
              className="verification__input"
              type="text"
              placeholder="Ingresa tu cuil"
              onChange={(e) => setCuil(e.target.value)}
            />

            <h2 htmlFor="cuotas">Cantidad de Cuotas:</h2>
            {/* ⚡ Aquí se usan los valores min/max traídos de Firebase */}
            <input
              className="verification__input"
              id="cuotas"
              type="range"
              min={simParams.minCuotas}
              max={simParams.maxCuotas}
              value={cuotas}
              onChange={handleCuotasChange}
            />
            <span>{`Cantidad de cuotas: ${cuotas}`}</span>

            <h2 htmlFor="monto">Monto Solicitado:</h2>
            {/* ⚡ Aquí se usan los valores min/max traídos de Firebase */}
            <input
              className="verification__input"
              id="monto"
              type="range"
              min={simParams.minMonto}
              max={simParams.maxMonto}
              step="5000"
              value={monto}
              onChange={handleMontoChange}
            />
            <span>{`Monto: $${monto}`}</span>
          </div>
        </div>
      </div>
      <div className="btn__container">
        <button
          className="verification__btn"
          onClick={checkCuilAvailability}
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner">Cargando...</span> : "Solicitar crédito"}
        </button>
      </div>

      {cuilError && 
        <div className="error-message_container">
          <div className="error-message">
            <div className="error-message_header">Error</div>
            <div className="error-message_body">{cuilError}</div>
          </div>
        </div>
      }

      <p className="version-text">v3.2</p>
    </div>
  );
}

export default Verification;