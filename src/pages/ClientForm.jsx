// src/pages/ClientForm.jsx
import React, { useState } from 'react';
import { db, ensureAuth } from '../firebase';
import '../css/ClientForm.css';
import Banner from "../components/Header";
import {
  doc,
  writeBatch,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { useNavigate, useLocation } from "react-router-dom";

export default function ClientForm() {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ingresoMensual, setIngresoMensual] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  const location = useLocation();
  const { cuil, monto, cuotas } = location.state || {};
  const navigate = useNavigate();

  const normalizePhone = (p) => (p || '').replace(/\D/g, '');
  const formatISODate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const today = new Date();
  const fechaSolicitud = formatISODate(today);

  const handleNombreChange = (e) => setNombre(e.target.value);
  const handleApellidoChange = (e) => setApellido(e.target.value);
  const handleTelefonoChange = (e) => setTelefono(e.target.value);
  const handleIngresoMensualChange = (e) => setIngresoMensual(e.target.value);

const handleAntiguedadChange = (e) => {
  const val = e.target.value; // YYYY-MM-DD
  if (!val) {
    setFechaIngreso('');
    return;
  }

  const ingresoDate = new Date(val);
  const now = new Date();

  // Debe ser al menos 6 meses atrás desde hoy
  const minAllowed = new Date(now);
  minAllowed.setMonth(minAllowed.getMonth() - 6);

  if (ingresoDate > minAllowed) {
    alert("Debes tener una antigüedad laboral mínima de 6 meses");
    e.target.value = '';
    setFechaIngreso('');
    return;
  }

  setFechaIngreso(val);
};


  const handleFechaNacimientoChange = (e) => {
    const val = e.target.value; // YYYY-MM-DD
    if (!val) {
      setFechaNacimiento('');
      return;
    }

    const birthDate = new Date(val);
    const now = new Date();

    const minAllowed = new Date(now);
    minAllowed.setFullYear(minAllowed.getFullYear() - 18);
    minAllowed.setMonth(minAllowed.getMonth() - 6);

    if (birthDate > minAllowed) {
      alert("Debes tener al menos 18 años y 6 meses de edad");
      e.target.value = '';
      setFechaNacimiento('');
      return;
    }

    setFechaNacimiento(val);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!nombre || !apellido || !cuil || !telefono || !monto || !cuotas || !ingresoMensual || !fechaIngreso || !fechaNacimiento) {
    alert('Por favor completa todos los campos');
    return;
  }

  // --- Validaciones de fecha ---
  const nacimientoDate = new Date(fechaNacimiento);
  const ingresoDate = new Date(fechaIngreso);
  const now = new Date();

  // Edad mínima 21
  const edad = (now - nacimientoDate) / (1000 * 60 * 60 * 24 * 365.25);
  if (edad < 21) {
    alert("Solo se aceptan solicitudes para mayores de 21 años");
    return;
  }

  // Ingreso no puede ser menor que nacimiento + 18
  const minIngresoDate = new Date(nacimientoDate);
  minIngresoDate.setFullYear(minIngresoDate.getFullYear() + 18);
  if (ingresoDate < minIngresoDate) {
    alert("La fecha de ingreso no puede ser anterior a tu fecha de nacimiento + 18 años");
    return;
  }

  // Antigüedad mínima 6 meses
  const minByTenure = new Date(now);
  minByTenure.setMonth(minByTenure.getMonth() - 6);
  if (ingresoDate > minByTenure) {
    alert("Debes tener una antigüedad laboral mínima de 6 meses");
    return;
  }

    // Teléfono: normalizar y validar
    const telClean = normalizePhone(telefono);
    if (telClean.length === 0) {
      alert("Ingresa un número de teléfono");
      return;
    }
    if (telClean.length > 10) {
      alert("El teléfono no debe tener más de 10 dígitos");
      return;
    }

    // (Opcional) Prechequeo de teléfono para feedback temprano
    try {
      const col = collection(db, 'clientes');
      const snap = await getDocs(query(col, where('telefono', '==', telClean)));
      if (!snap.empty) {
        alert('Ese número de teléfono ya está registrado.');
        return;
      }
    } catch {
      // Si falla por permisos, dejamos que lo frenen las reglas en el batch
    }

    setIsSubmitting(true);
    setShowSpinner(true);

    try {
      // Asegura autenticación (anónima) para cumplir reglas
      const user = await ensureAuth();
      const uid = user.uid;

      // Batch: cliente + marcadores de unicidad
      const clienteRef = doc(collection(db, "clientes")); // ID auto
      const cuilRef    = doc(db, "_unique_cuil", String(cuil));
      const phoneRef   = doc(db, "_unique_phones", telClean);

      const batch = writeBatch(db);

      batch.set(clienteRef, {
        nombre,
        apellido,
        cuil: String(cuil),
        telefono: telClean,
        monto,
        cuotas,
        ingresoMensual,
        fechaIngreso,
        fechaSolicitud,
        timestamp: serverTimestamp(),
        owner: uid,
      });

      batch.set(cuilRef,  { owner: uid });
      batch.set(phoneRef, { owner: uid });

      await batch.commit();

      alert('Solicitud enviada. ¡Gracias!');
      navigate('/');
    } catch (err) {
      console.error('Error al registrar:', err);
      const msg =
        err?.code === 'permission-denied'
          ? 'Ese CUIL o teléfono ya está registrado.'
          : err?.message || 'Ocurrió un error al enviar la solicitud';
      alert(msg);
    } finally {
      setIsSubmitting(false);
      setShowSpinner(false);
    }
  };

  return (
    <div className='main'>
      <div className="banner__container"><Banner /></div>
      <h1 className='firsth1'>Solicitá tu crédito</h1>

      <form onSubmit={handleSubmit}>
        <div className='form__container'>
          <div className='form__container__leftpanel'>
            <h3 className='user__data'>
              <label>CUIL: <span>{cuil}</span></label>
            </h3>
            <h3 className='user__data'>
              <label>MONTO: <span>{monto}</span></label>
            </h3>
            <h3 className='user__data'>
              <label>CUOTAS: <span>{cuotas}</span></label>
            </h3>

            <label>
              Nombre:
              <input type="text" value={nombre} onChange={handleNombreChange} />
            </label>

            <label>
              Apellido:
              <input type="text" value={apellido} onChange={handleApellidoChange} />
            </label>
          </div>

          <div className='form__container__rightpanel'>
            <label>
              Teléfono:
              <input
                type="tel"
                value={telefono}
                onChange={handleTelefonoChange}
                placeholder="Ej: (0351) 456-7890"
              />
            </label>

            <label>
              Ingreso mensual:
              <input type="number" value={ingresoMensual} onChange={handleIngresoMensualChange} />
            </label>

            <label>
              Fecha de Nacimiento (DD/MM/AAAA):
              <input
                type="date"
                placeholder="DD/MM/AAAA"
                value={fechaNacimiento}
                onChange={handleFechaNacimientoChange}
              />
            </label>

            <label>
              Fecha de Ingreso (Antigüedad):
              <input
                type="date"
                placeholder="DD/MM/AAAA"
                value={fechaIngreso}
                onChange={handleAntiguedadChange}
              />
            </label>
          </div>
        </div>

        {/* Se removió el bloque de "Datos de la cuenta" (email/contraseña) */}

        <button className='form__btn' type="submit" disabled={isSubmitting}>
          {showSpinner ? <span className="spinner">Procesando...</span> : 'Enviar'}
        </button>

        <div className="statement__text">
          <p>
            Una vez aprobada tu solicitud, un representante de MicroCuotas se comunicará...
          </p>
        </div>
      </form>
    </div>
  );
}
