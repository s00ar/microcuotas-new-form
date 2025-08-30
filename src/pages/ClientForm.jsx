import React, { useState } from 'react';
import { db } from '../firebase';
import '../css/ClientForm.css';
import Banner from "../components/Header";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

function ClientForm(props) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ingresoMensual, setIngresoMensual] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const location = useLocation();
  const { cuil, monto, cuotas } = location.state;
  const navigate = useNavigate();

  const handleNombreChange = (e) => {
    setNombre(e.target.value);
  };

  const handleApellidoChange = (e) => {
    setApellido(e.target.value);
  };

  const handleTelefonoChange = (e) => {
    if (!isNaN(Number(e.target.value))) {
      setTelefono(e.target.value);
    } else {
      alert("El campo de teléfono debe ser un número");
    }
  };

  const handleIngresoMensualChange = (e) => {
    setIngresoMensual(e.target.value);
  };

  const handleAntiguedadChange = (e) => {
    const startDate = new Date(e.target.value);
    const today = new Date();
    const monthsDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

    if (monthsDiff < 6) {
      alert("Debes tener una antigüedad laboral mínima de 6 meses para enviar el formulario");
      e.target.value = '';
    } else {
      setFechaIngreso(e.target.value);
    }
  };

  const today = new Date();
  const fechaSolicitud = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if any of the required fields is empty
    if (
      !nombre ||
      !apellido ||
      !cuil ||
      !telefono ||
      !monto ||
      !cuotas ||
      !ingresoMensual ||
      !fechaIngreso ||
      !fechaSolicitud
    ) {
      alert('Por favor completar todos los campos');
      return;
    }

    const startDate = new Date(fechaIngreso);
    const monthsDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

    if (monthsDiff < 6) {
      alert("Debes tener una antigüedad laboral mínima de 6 meses para enviar el formulario");
      return;
    }

    const telefonoLimpio = telefono.replace(/[\s\-()+]/g, '');

    if (!telefonoLimpio.match(/^(\+54)?\d{10,11}$/)) {
      alert("Ingrese un número de teléfono argentino válido.\nEjemplos válidos:\n- 3514567890\n- 1134567890\n- +5491123456789");
      return;
    }

    setIsSubmitting(true);
    setShowSpinner(true); // Mostrar spinner inmediatamente después del clic

    try {
      const clientesCollection = collection(db, 'clientes');
      const timestamp = serverTimestamp();
      await addDoc(clientesCollection, {
        nombre,
        apellido,
        cuil,
        monto,
        cuotas,
        telefono: telefonoLimpio,
        ingresoMensual,
        fechaIngreso,
        fechaSolicitud,
        timestamp
      });

      setNombre('');
      setApellido('');
      setTelefono('');
      setIngresoMensual('');
      setFechaIngreso('');

      alert('Datos registrados exitosamente!');
      navigate("/");
    } catch (error) {
      console.error('Error submitting data:', error);
      alert('An error occurred while submitting data');
    } finally {
      setIsSubmitting(false);
      setShowSpinner(false); // Ocultar spinner al finalizar el proceso
    }
  };

  return (
    <div className='main'>
      <div className="banner__container">
        <Banner />
      </div>
      <h1 className='firsth1'>Solicitá tu crédito</h1>
      <form onSubmit={handleSubmit}>
        <div className='form__container'>
          <div className='form__container__leftpanel'>
            <h3 className='user__data'>
              <label>
                CUIL:
                <span>{cuil}</span>
              </label>
            </h3>

            <h3 className='user__data'>
              <label>
                MONTO:
                <span>{monto}</span>
              </label>
            </h3>

            <h3 className='user__data'>
              <label>
                CUOTAS:
                <span>{cuotas}</span>
              </label>
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
              Fecha de Ingreso a su actual empleo (Antigüedad):
              <input type="date" value={fechaIngreso} onChange={handleAntiguedadChange} />
            </label>
          </div>
        </div>
        <button className='form__btn' type="submit" disabled={isSubmitting}>
          {showSpinner ? <span className="spinner">Procesando...</span> : 'Enviar'}
        </button>
        <div className="statement__text">
          <p>
            Una vez que su solicitud de crédito sea aprobada por nuestro equipo de evaluación, un representante comercial de Microcuotas se comunicará con usted para solicitar cualquier documentación adicional necesaria. La transferencia del dinero se realizará previa firma del solicitante en la sucursal de Microcuotas. Donde se le entregará la carpeta de crédito con todos los detalles de su préstamo.
          </p>
        </div>
      </form>
    </div>
  );
}

export default ClientForm;
