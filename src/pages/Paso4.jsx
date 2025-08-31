import "../css/Pasos.css";
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Banner from "../components/Header";
import LottieAnim from "../components/LottieAnim";
import { FaCheck } from "react-icons/fa";

function Paso4() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cuil, cuotas, monto, birthdate, nombre } = location.state || {};

  const formattedBirthdate = birthdate
    ? new Date(birthdate).toLocaleDateString("es-AR")
    : "";
  const formattedCuil = cuil
    ? cuil.replace(/(\d{2})(\d{8})(\d{1})/, "$1-$2-$3")
    : "";

  const handleYes = () => {
    navigate("/clientform", { state: { cuil, cuotas, monto, birthdate, nombre } });
  };

  const handleNo = () => {
    navigate("/rechazo1", { state: { cuil, cuotas, monto, birthdate, nombre } });
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
            <p>
              Fecha de Nacimiento (DD/MM/AAAA): {formattedBirthdate} {" "}
              <FaCheck color="green" />
            </p>
            <p>
              CUIL o CUIT: {formattedCuil} <FaCheck color="green" />
            </p>
            <p className="verification__container__panel_right_question">
              Usted es <strong>{nombre}</strong> ?
            </p>
          </div>
        </div>
      </div>
      <div className="btn__container">
        <button className="verification__btn" onClick={handleYes}>
          Sí, soy yo
        </button>
        <button className="verification__btn" onClick={handleNo}>
          No
        </button>
      </div>
    </div>
  );
}

export default Paso4;
