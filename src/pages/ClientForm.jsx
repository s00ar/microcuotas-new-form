// src/pages/ClientForm.jsx
import React, { useState } from 'react';
import { db, auth } from '../firebase';                                      // ← Importa auth
import '../css/ClientForm.css';
import Banner from "../components/Header";
import { 
  collection,
  query,
  where,
  getDocs,
  addDoc,  
  serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';  // ← Importa Auth methods
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

export default function ClientForm() {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ingresoMensual, setIngresoMensual] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');                 // ← Fecha de nacimiento
  const [email, setEmail] = useState('');                                     // ← Email
  const [password, setPassword] = useState('');                               // ← Clave
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  const location = useLocation();
  const { cuil, monto, cuotas } = location.state;                             // :contentReference[oaicite:0]{index=0}
  const navigate = useNavigate();

  // Manejadores existentes
  const handleNombreChange = e => setNombre(e.target.value);
  const handleApellidoChange = e => setApellido(e.target.value);
  const handleTelefonoChange = e => {
    if (!isNaN(Number(e.target.value))) setTelefono(e.target.value);
    else alert("El campo de teléfono debe ser un número");
  };
  const handleIngresoMensualChange = e => setIngresoMensual(e.target.value);
  const handleAntiguedadChange = e => {
    const start = new Date(e.target.value);
    const diffMeses = Math.floor((Date.now() - start.getTime()) / (1000*60*60*24*30));
    if (diffMeses < 6) {
      alert("Debes tener una antigüedad laboral mínima de 6 meses");
      e.target.value = '';
    } else setFechaIngreso(e.target.value);
  };

  // Nuevos manejadores
  const handleFechaNacimientoChange = e => {
    const val = e.target.value;
    setFechaNacimiento(val); // Si está vacío, simplemente actualiza el estado
  };
  const handleEmailChange = e => setEmail(e.target.value);
  const handlePasswordChange = e => setPassword(e.target.value);

  const today = new Date();
  const fechaSolicitud = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;

  const handleSubmit = async e => {
    e.preventDefault();

    // — Validar fecha de nacimiento y edad ≥21
    // const [dd, mm, aaaa] = fechaNacimiento.split('/');

    // Dentro de handleSubmit, en lugar de esto:
    // const [dd, mm, aaaa] = fechaNacimiento.split('/');

    // Haz algo así:
    let dd, mm, aaaa;

    if (fechaNacimiento.includes('/')) {
      [dd, mm, aaaa] = fechaNacimiento.split('/');
    } else if (fechaNacimiento.includes('-')) {
      // viene del <input type="date">: "YYYY-MM-DD"
      [aaaa, mm, dd] = fechaNacimiento.split('-');
    } else {
      alert("Ingresa tu fecha de nacimiento en formato DD/MM/AAAA");
      return;
    }

    if (!dd || !mm || !aaaa) {
      alert("Ingresa tu fecha de nacimiento en formato DD/MM/AAAA");
      return;
    }

    // luego calculas la edad con la fecha correcta...

    if (!dd || !mm || !aaaa) {
      alert("Ingresa tu fecha de nacimiento en formato DD/MM/AAAA");
      return;
    }
    const birth = new Date(`${aaaa}-${mm}-${dd}`);
    const age = (Date.now() - birth.getTime()) / (1000*60*60*24*365.25);
    if (age < 21) {
      alert("Solo se aceptan solicitudes para mayores de 21 años");
      return;
    }

        // — Teléfono máximo 10 dígitos
    const telClean = telefono.replace(/\D/g, '');
    if (telClean.length > 10) {
      alert("El teléfono no debe tener más de 10 dígitos");
      return;
    }

    // — Email y password obligatorios
    if (!email || !password) {
      alert("Debes ingresar email y contraseña para crear tu cuenta");
      return;
    }

    // — 1) Valido unicidad CUIL, email y teléfono en Firestore —
    const col = collection(db, 'clientes');

    // 1a) Sólo bloqueo si ya hubo solicitud en los últimos 30 días
  let snap = await getDocs(query(col, where('cuil', '==', cuil)));
  const ahora = Date.now();
  const treintaDias = 30 * 24 * 60 * 60 * 1000;

  const reciente = snap.docs.some(d => {
    const ts = d.data().timestamp;
    // ts puede venir como Timestamp de Firestore
    const fecha = ts?.toDate?.() ?? new Date(ts);
    return ahora - fecha.getTime() < treintaDias;
  });

  if (reciente) {
    alert('Solo puedes solicitar crédito con el mismo CUIL una vez cada 30 días.');
    return;
  }
    // 1b) Email
    snap = await getDocs(query(col, where('email', '==', email)));
    if (!snap.empty) {
      alert('Ese correo ya está registrado.');
      return;
    }
    // 1c) Teléfono
    snap = await getDocs(query(col, where('telefono', '==', telClean)));
    if (!snap.empty) {
      alert('Ese número de teléfono ya está registrado.');
      return;
    }

    // — 2) Crear usuario en Auth y enviar código de verificación —
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCred.user);
      alert(
        'Hemos enviado un correo con un código/enlace de verificación. ' +
        'Por favor revisa tu email y haz clic en el enlace para activar tu cuenta.'
      );
    } catch (authErr) {
      console.error("Error al crear cuenta:", authErr);
      alert("No se pudo crear la cuenta: " + authErr.message);
      return;
    }


    // — Validaciones previas existentes
    if (
      !nombre || !apellido || !cuil ||
      !telefono || !monto || !cuotas ||
      !ingresoMensual || !fechaIngreso || !fechaSolicitud
    ) {
      alert('Por favor completa todos los campos');
      return;
    }

    // — Guardar en Firestore
    setIsSubmitting(true);
    setShowSpinner(true);
    try {
    await addDoc(collection(db, 'clientes'), {
      nombre,
      apellido,
      cuil,
      email,               // ← guarda también correo en tu doc
      telefono: telClean,
      monto,
      cuotas,
      ingresoMensual,
      fechaIngreso,
      fechaSolicitud,
      timestamp: serverTimestamp()
    });
    navigate('/');
  } catch (err) {
    console.error('Error al registrar datos:', err);
    alert('Ocurrió un error al enviar la solicitud');
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
              <input type="tel" value={telefono} onChange={handleTelefonoChange} />
            </label>
            <label>
              Ingreso mensual:
              <input type="number" value={ingresoMensual} onChange={handleIngresoMensualChange} />
            </label>
            <label>
              Fecha de Ingreso (Antigüedad):
              <input
                type="date" 
                placeholder="DD/MM/AAAA"
                value={fechaIngreso} 
                onChange={handleAntiguedadChange             
                } />
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
          </div>
        </div>
        <div className="form__container__account">
          <h3>
              Datos de la cuenta
            </h3>
              <span>A continuación, ingresa tu email y contraseña para crear tu cuenta. </span>
              <p>Para poder gestionar tus solicitudes de préstamo, por favor ingresa un correo electrónico válido y crea una contraseña segura. Una vez que envíes el formulario, recibirás un correo en la dirección que indiques con un enlace de verificación. Deberás abrir ese correo y hacer clic en el enlace para activar tu cuenta en MicroCuotas. Solo después de verificar tu email podrás acceder a tu panel personal y consultar el estado de todas tus solicitudes.</p>
            <label>
              Email:
              <input type="email" value={email} onChange={handleEmailChange} />
            </label>

            <label>
              Contraseña:
              <input type="password" value={password} onChange={handlePasswordChange} />
            </label>
        </div>
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
