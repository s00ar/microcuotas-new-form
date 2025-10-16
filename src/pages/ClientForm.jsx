import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import Banner from "../components/Header";
import "../css/ClientForm.css";
import { db } from "../firebase";
import { isFieldUnique, isCuilRegistrable } from "../services/solicitudes";
import { useGlobalLoadingEffect } from "../components/GlobalLoadingProvider";

const formatFechaSolicitud = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const MIN_MESES_ANTIGUEDAD = 6;

const TELEFONO_EJEMPLO = "1142681704";
const MOTIVO_TELEFONO_REPETIDO = "El nÃºmero de telÃ©fono ingresado ya fue utilizado en otra solicitud.";
const CONTACTO = "1142681704";
const TEST_CUIL = "20303948091";
const MOTIVO_CUIL_RECIENTE = `El CUIL ingresado ya registra una solicitud en los Ãºltimos 30 dÃ­as. Comunicate al ${CONTACTO} para continuar con la gestiÃ³n.`;

function ClientForm() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ingresoMensual, setIngresoMensual] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  useGlobalLoadingEffect(isSubmitting);

  const location = useLocation();
  const navigate = useNavigate();
  const { cuil, monto, cuotas } = location.state || {};

  const handleTelefonoChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, "");
    setTelefono(digitsOnly);
  };

  const handleAntiguedadChange = (event) => {
    const startDate = new Date(event.target.value);
    const today = new Date();
    const monthsDiff = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (Number.isFinite(monthsDiff) && monthsDiff < MIN_MESES_ANTIGUEDAD) {
      alert("Debes tener una antigÃ¼edad laboral mÃ­nima de 6 meses para enviar el formulario.");
      event.target.value = "";
      return;
    }

    setFechaIngreso(event.target.value);
  };

  const resetForm = () => {
    setNombre("");
    setApellido("");
    setTelefono("");
    setIngresoMensual("");
    setFechaIngreso("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !nombre ||
      !apellido ||
      !cuil ||
      !telefono ||
      !monto ||
      !cuotas ||
      !ingresoMensual ||
      !fechaIngreso
    ) {
      alert("Por favor completÃ¡ todos los campos requeridos.");
      return;
    }

    const today = new Date();
    const startDate = new Date(fechaIngreso);
    const monthsDiff = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (!Number.isFinite(monthsDiff) || monthsDiff < MIN_MESES_ANTIGUEDAD) {
      alert("Debes tener una antigÃ¼edad laboral mÃ­nima de 6 meses para enviar el formulario.");
      return;
    }

    const telefonoNormalizado = telefono.replace(/\D/g, "");

    if (telefonoNormalizado.length < 10) {
      alert(`El telÃ©fono debe tener 10 dÃ­gitos. Faltan nÃºmeros. Ejemplo: ${TELEFONO_EJEMPLO}.`);
      return;
    }

    if (telefonoNormalizado.length > 10) {
      alert(`El telÃ©fono no debe superar los 10 dÃ­gitos. Cargalo sin 0 ni 15, por ejemplo: ${TELEFONO_EJEMPLO}.`);
      return;
    }

    setIsSubmitting(true);
    setShowSpinner(true);

    try {
      const cuilNormalizado = String(cuil || "").replace(/\D/g, "");
      const [telefonoDisponible, cuilDisponible] = await Promise.all([
        isFieldUnique("telefono", telefonoNormalizado, {
          ignoreEstados: ["rechazada"],
          sameCuilValue: cuilNormalizado,
        }),
        cuilNormalizado === TEST_CUIL ? Promise.resolve(true) : isCuilRegistrable(cuilNormalizado),
      ]);

      if (!telefonoDisponible) {
        alert(MOTIVO_TELEFONO_REPETIDO);
        return;
      }

      if (!cuilDisponible) {
        alert(MOTIVO_CUIL_RECIENTE);
        return;
      }

      const clientesCollection = collection(db, "clientes");
      await addDoc(clientesCollection, {
        nombre,
        apellido,
        cuil: cuilNormalizado,
        monto,
        cuotas,
        telefono: telefonoNormalizado,
        ingresoMensual,
        fechaIngreso,
        fechaSolicitud: formatFechaSolicitud(today),
        estado: "pendiente",
        resultadoEvaluacionCodigo: null,
        resultadoEvaluacionDescripcion: null,
        timestamp: serverTimestamp(),
      });

      resetForm();

      alert("Datos registrados exitosamente!");
      navigate("/");
    } catch (error) {
      console.error("Error submitting data:", error);
      alert("OcurriÃ³ un error al guardar la solicitud. IntentÃ¡ nuevamente.");
    } finally {
      setIsSubmitting(false);
      setShowSpinner(false);
    }
  };

  return (
    <div className="main">
      <div className="banner__container">
        <Banner />
      </div>
      <h1 className="firsth1">SolicitÃ¡ tu crÃ©dito</h1>
      <form onSubmit={handleSubmit}>
        <div className="form__container">
          <div className="form__container__leftpanel">
            <h3 className="user__data">
              <label>
                CUIL:
                <span>{cuil}</span>
              </label>
            </h3>

            <h3 className="user__data">
              <label>
                MONTO:
                <span>{monto}</span>
              </label>
            </h3>

            <h3 className="user__data">
              <label>
                CUOTAS:
                <span>{cuotas}</span>
              </label>
            </h3>

            <label>
              Nombre:
              <input
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
              />
            </label>

            <label>
              Apellido:
              <input
                type="text"
                value={apellido}
                onChange={(event) => setApellido(event.target.value)}
              />
            </label>
          </div>
          <div className="form__container__rightpanel">
            <label>
              TelÃ©fono:
              <input
                type="tel"
                value={telefono}
                onChange={handleTelefonoChange}
                placeholder="1123456789"
              />
            </label>

            <label>
              Ingreso mensual:
              <input
                type="number"
                value={ingresoMensual}
                onChange={(event) => setIngresoMensual(event.target.value)}
              />
            </label>

            <label>
              Fecha de ingreso a su actual empleo (AntigÃ¼edad):
              <input
                type="date"
                value={fechaIngreso}
                onChange={handleAntiguedadChange}
              />
            </label>
          </div>
        </div>
        <button className="form__btn" type="submit" disabled={isSubmitting}>
          {showSpinner ? (
            <span className="spinner">Procesando...</span>
          ) : (
            "Enviar"
          )}
        </button>
        <div className="statement__text">
          <p>
            Una vez que su solicitud de crÃ©dito sea aprobada por nuestro equipo de evaluaciÃ³n, un representante
            comercial de Microcuotas se comunicarÃ¡ con usted para solicitar cualquier documentaciÃ³n adicional necesaria.
            La transferencia del dinero se realizarÃ¡ previa firma del solicitante en la sucursal de Microcuotas, donde se
            le entregarÃ¡ la carpeta de crÃ©dito con todos los detalles de su prÃ©stamo.
          </p>
        </div>
      </form>
    </div>
  );
}

export default ClientForm;
