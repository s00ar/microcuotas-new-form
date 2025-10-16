import "../css/Pasos.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";
import { FaCheckSquare } from "react-icons/fa";
import { splitFullName } from "../utils/person";
import { saveAceptada, isCuilRegistrable } from "../services/solicitudes";
import { useGlobalLoadingEffect } from "../components/GlobalLoadingProvider";

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string" && value.includes("-")) {
    const parts = value.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = String(date.getFullYear());
      return `${day}-${month}-${year}`;
    }
  } catch (err) {
    console.warn("Paso5.formatDate error", err);
  }
  return String(value);
};

const formatCuil = (value) => {
  if (!value) {
    return "";
  }
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.length !== 11) {
    return String(value);
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

const TELEFONO_EJEMPLO = "1142681704";
const CONTACTO = "1142681704";
const TEST_CUIL = "20303948091";
const MENSAJE_CUIL_RECIENTE = `El CUIL ingresado ya registra una solicitud en los últimos 30 días. Comunicate al ${CONTACTO} para continuar con la gestión.`;

const normalizePhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  const prefixes = ["549", "54", "15", "0"];
  let removed = true;
  while (digits.length > 10 && removed) {
    removed = false;
    for (const prefix of prefixes) {
      if (digits.startsWith(prefix) && digits.length - prefix.length >= 10) {
        digits = digits.slice(prefix.length);
        removed = true;
        break;
      }
    }
  }
  return digits;
};

const isValidPhone = (value) => /^\d{10}$/.test(value);

const isValidEmail = (value) =>
  /^(?:[a-zA-Z0-9_'^&+-])+(?:\.(?:[a-zA-Z0-9_'^&+-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(
    value
  );

function Paso5() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuil, cuotas, monto, birthdate, nombre: fullName, bcraData } = location.state || {};
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  useGlobalLoadingEffect(isSubmitting);

  const formattedDate = useMemo(() => formatDate(birthdate), [birthdate]);
  const formattedCuil = useMemo(() => formatCuil(cuil), [cuil]);
  const { nombre, apellido } = useMemo(() => splitFullName(fullName), [fullName]);

  useEffect(() => {
    if (!cuil) {
      navigate("/paso1", { replace: true });
    }
  }, [cuil, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || submitLockRef.current) {
      return;
    }

    const telefonoNormalizado = normalizePhone(telefono);
    if (telefonoNormalizado.length < 10) {
      window.alert(`El teléfono debe tener 10 dígitos. Faltan números. Ejemplo: ${TELEFONO_EJEMPLO}.`);
      return;
    }
    if (telefonoNormalizado.length > 10) {
      window.alert(
        `El teléfono no debe superar los 10 dígitos. Cargalo sin prefijos (0, 15 o +54). Ejemplo: ${TELEFONO_EJEMPLO}.`
      );
      return;
    }
    if (!isValidPhone(telefonoNormalizado)) {
      window.alert(`Ingresá un número de teléfono argentino válido de 10 dígitos. Ejemplo: ${TELEFONO_EJEMPLO}.`);
      return;
    }

    const emailNormalizado = String(email || "").trim().toLowerCase();
    if (!emailNormalizado || !isValidEmail(emailNormalizado)) {
      window.alert("Ingresá un correo electrónico válido.");
      return;
    }

    const releaseLock = () => {
      submitLockRef.current = false;
      setIsSubmitting(false);
    };

    setIsSubmitting(true);
    submitLockRef.current = true;

    try {
      const cuilNormalizado = String(cuil || "").replace(/\D/g, "");
      if (cuilNormalizado !== TEST_CUIL) {
        const puedeRegistrar = await isCuilRegistrable(cuilNormalizado);
        if (!puedeRegistrar) {
          window.alert(MENSAJE_CUIL_RECIENTE);
          releaseLock();
          return;
        }
      }

      await saveAceptada({
        nombre,
        apellido,
        nombreCompleto: fullName,
        cuil: cuilNormalizado,
        monto,
        cuotas,
        telefono: telefonoNormalizado,
        email: emailNormalizado,
        fechaNacimiento: birthdate || null,
        bcra: bcraData || null,
        origen: "paso5",
      });

      releaseLock();
      navigate("/solicitud-exitosa", {
        state: {
          nombre: fullName,
        },
      });
    } catch (error) {
      console.error("Paso5 submission error", error);
      if (error?.code === "duplicate_fields") {
        const fields = Array.isArray(error.fields) ? error.fields : [];
        if (fields.includes("telefono")) {
          window.alert("El teléfono ingresado ya fue utilizado en otra solicitud.");
        } else if (fields.includes("email")) {
          window.alert("El correo electrónico ingresado ya fue utilizado en otra solicitud.");
        } else if (fields.includes("cuil")) {
          window.alert(MENSAJE_CUIL_RECIENTE);
        } else {
          window.alert("Ya existe una solicitud con los datos ingresados.");
        }
      } else {
        window.alert("Ocurrió un error al registrar la solicitud. Intentá nuevamente.");
      }
      releaseLock();
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
            <div className="verification__details">
              <div className="verification__details-row">
                <span className="verification__details-label">
                  Fecha de Nacimiento (DD/MM/AAAA):
                </span>
                <span className="verification__details-value">{formattedDate || "--"}</span>
                <FaCheckSquare className="verification__details-icon" />
              </div>
              <div className="verification__details-row">
                <span className="verification__details-label">CUIL o CUIT:</span>
                <span className="verification__details-value">{formattedCuil || "--"}</span>
                <FaCheckSquare className="verification__details-icon" />
              </div>
              <div className="verification__details-row">
                <span className="verification__details-label">Nombre:</span>
                <span className="verification__details-value">{fullName || "--"}</span>
                <FaCheckSquare className="verification__details-icon" />
              </div>
            </div>

            <form className="verification__form" onSubmit={handleSubmit}>
              <label className="verification__form-label">
                Teléfono
                <input
                  className="verification__input verification__form-input"
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value.replace(/\D/g, ""))}
                  placeholder="Ej: 1123456789"
                  disabled={isSubmitting}
                />
              </label>
              <label className="verification__form-label">
                Correo electrónico
                <input
                  className="verification__input verification__form-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@correo.com"
                  disabled={isSubmitting}
                />
              </label>
              <div className="verification__actions">
                <button className="verification__btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Continuar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Paso5;
