import "../css/Verification.css";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { query, collection, getDocs, where } from "firebase/firestore";
import Banner from "../components/Header";
import verificationImage from "../assets/verification.jpg";

function Verification(props) {
  const navigate = useNavigate();
  const [cuil, setCuil] = useState("");
  const [cuilError, setCuilError] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [monto, setMonto] = useState(10000);
  const [clienteRecurrente, setClienteRecurrente] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Estado para el spinner

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCuotas = urlParams.get("cuotas");
    const urlMonto = urlParams.get("monto");

    if (!cuotas) {
      setCuotas('2');
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

  const handleCuotasChange = (e) => {
    const newValue = parseInt(e.target.value);
    if (!clienteRecurrente && newValue >= 2 && newValue <= 6) {
      setCuotas(newValue);
    } else if (clienteRecurrente && newValue >= 2 && newValue <= 12) {
      setCuotas(newValue);
    }
  };

  const handleMontoChange = (e) => {
    const newValue = parseInt(e.target.value);
    if ((!clienteRecurrente && newValue >= 10000 && newValue <= 125000) || (clienteRecurrente && newValue >= 10000 && newValue <= 250000)) {
      setMonto(newValue);
    }
  };

  const handleClienteRecurrente = () => {
    setClienteRecurrente(!clienteRecurrente);
    setMonto(10000); 
    setCuotas('2');
  };
  
  const closeError = () => {
    setCuilError("");
    window.location.reload(); // Refresh the window
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
            <h2>Por favor ingresa tu cuil</h2>
            <input
              className="verification__input"
              type="text"
              placeholder="Ingresa tu cuil"
              onChange={(e) => setCuil(e.target.value)}
            />
            <div className="verification__container__panel_right_question">
              <label className="row">
                ¿Es usted un cliente recurrente?
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={clienteRecurrente}
                  onChange={handleClienteRecurrente}
                />
              </label>
            </div>
            <h2 htmlFor="cuotas">Cantidad de Cuotas:</h2>
            <input
              className="verification__input"
              placeholder="6"
              id="cuotas"
              type="range"
              min="2"
              max={clienteRecurrente ? 12 : 6}
              value={cuotas}
              onChange={handleCuotasChange}
            />
            <span>{`Cantidad de cuotas: ${cuotas}`}</span>
            <h2 htmlFor="monto">Monto Solicitado:</h2>
            <input
              className="verification__input"
              placeholder="$100.000 pesos"
              id="monto"
              type="range"
              min="10000"
              max={clienteRecurrente ? 250000 : 125000}
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
          disabled={isLoading} // Deshabilitar botón mientras se carga
        >
          {isLoading ? <span className="spinner">Cargando...</span> : "Solicitar crédito"}
        </button>
      </div>

      {cuilError && 
      <div className="error-message_container">
      <div className="error-message">
        <div className="error-message_header">
          Error
        </div>
        <div className="error-message_body">
      El CUIL ya fue registrado en los últimos 30 días. Solamente se puede ingresar una solicitud cada 30 días.
        </div>
      </div>
    </div>}
    
          {/* version actual del software */}
          <p className="version-text">
            v2.0.1
          </p>
    </div>
  );
}

export default Verification;
