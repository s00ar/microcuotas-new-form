import "../css/Verification.css";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
// import { query, collection, getDocs, where } from "firebase/firestore";
import { query, collection, getDocs, where, orderBy, Timestamp } from "firebase/firestore";
import Banner from "../components/Header";

function Verification(props) {
  const navigate = useNavigate();
  const [cuil, setCuil] = useState("");
  const [cuilError, setCuilError] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [monto, setMonto] = useState(10000);
  const [clienteRecurrente, setClienteRecurrente] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCuotas = urlParams.get("cuotas");
    const urlMonto = urlParams.get("monto");

    if (urlCuotas) {
      setCuotas(urlCuotas);
    }
    if (urlMonto) {
      setMonto(urlMonto);
    }
  }, []);

  const checkCuilAvailability = async () => {
    try {
      if (!cuil) {
        setCuilError("CUIL no puede estar en blanco");
        return;
      }
      if (!monto) {
        setCuilError("El monto no puede estar en blanco");
        return;
      }
      if (!cuotas) {
        setCuilError("La cantidad de cuotas no puede estar en blanco");
        return;
      }

      if (cuil.length !== 11) {
        setCuilError("Ingresa un CUIL válido");
        return;
      }

      const q = query(collection(db, 'clientes'), where('cuil', '==', cuil));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.size > 0) {
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
          setCuilError("El CUIL ya fué registrado en los últimos 30 días. Solamente se puede ingresar una solicitud cada 30 días.");
        } else {
          setCuilError('Timestamp is undefined for document with CUIL:', cuil);
        }
      } else {
        setCuilError("");
        navigate("/clientform", { state: { cuil, cuotas, monto } });
      }
    } catch (error) {
      console.error('Error checking CUIL availability:', error);
      setCuilError("Ocurrió un error al verificar el CUIL. Inténtelo de nuevo más tarde.");
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
    setCuotas('');
  }

  return (
    <div>
      <div className="banner__container">
        <Banner />
      </div>
      <div className="verification__container">
        <div className="verification__container__leftpanel">
            <h2>Por favor ingresa tu cuil</h2>
            <input
              className="verification__input"
              type="text"
              placeholder="Ingresa tu cuil"
              onChange={(e) => setCuil(e.target.value)}
            />
            <h2 htmlFor="cuotas">Cantidad de Cuotas:</h2>
            <input
              className="verification__input"
              placeholder="6 cuotas"
              id="cuotas"
              type="number"
              min="2"
              max={clienteRecurrente ? 12 : 6}
              value={cuotas}
              onChange={handleCuotasChange}
            />
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
          <div className="verification__container__rightpanel">
            <div className="row">
              <label>
                ¿Es usted un cliente recurrente?
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={clienteRecurrente}
                  onChange={handleClienteRecurrente}
                />
              </label>
            </div>
            <div className="row">
              <button
                className="btn"
                onClick={checkCuilAvailability}
              >Solicitar crédito
              </button>
            </div>
          </div>
      </div>
      {cuilError && <div className="error-message">{cuilError}</div>}
    </div>
  );
}

export default Verification;
