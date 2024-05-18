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
    if (!isNaN(Number(e.target.value)) ) {
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
  
    // Valida si la antigüedad es mayor o igual a 6 meses
    if (monthsDiff < 6) {
      alert("Debes tener una antigüedad laboral mínima de 6 meses para enviar el formulario");
      // Evita que se guarde el valor de la fecha
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

    const today = new Date();
  
    const startDate = new Date(fechaIngreso);
    const monthsDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    // Valida si la antigüedad es mayor o igual a 6 meses
    if (monthsDiff < 6) {
      alert("Debes tener una antigüedad laboral mínima de 6 meses para enviar el formulario");
      return;
    }

    // Upload files to Firebase Storage
    if (!telefono.match(/^[11|15]\d{9}$/)) {
      alert("El campo de teléfono debe ser un número de Argentina");
      return;
    }
    try {


      // Save data to Firebase Firestore
      const clientesCollection = collection(db, 'clientes');
      //added timestamp with form
      const timestamp = serverTimestamp();
      await addDoc(clientesCollection, {
        nombre,
        apellido,
        cuil,
        monto,
        cuotas,
        telefono,
        ingresoMensual,
        fechaIngreso,
        fechaSolicitud,
        timestamp
      });

      // Clear all fields after successful submission
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
    }
  };


  return (
    <div className='main'>
      <div className="banner__container">
        <Banner />
      </div>
      <h1 className='firsth1'>Solicitá tu crédito</h1>
      <form onSubmit={handleSubmit}>
        <div className='form__container' >
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
        <button className='form__btn' type="submit">Enviar</button>
        <div className="statement__text">
          <p>


            Una vez que su solicitud de crédito sea aprobada por nuestro equipo de evaluación, un representante comercial de Microcuotas se comunicará con usted para solicitarle cualquier documentación adicional necesaria.

          La transferencia del dinero se realizará previa firma del solicitante en la sucursal de Microcuotas, donde se le entregará su carpeta de crédito con todos los detalles de su préstamo.

          Este texto podría ampliarse de la siguiente manera:

          Una vez que Microcuotas reciba la documentación solicitada, se procederá a la transferencia del dinero a su cuenta bancaria. La transferencia se realizará en un plazo máximo de 24 horas hábiles.

          Para completar la transferencia, deberá firmar su carpeta de crédito en la sucursal de Microcuotas. En la carpeta de crédito encontrará todos los detalles de su préstamo, como el monto, el plazo, la tasa de interés y las cuotas.

          </p>
        </div>
      </form>
    </div>
  );
};

export default ClientForm;