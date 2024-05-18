import React from 'react';
import Logo from '../assets/logo_textoblanco_fondotransp.png';
import '../css/Header.css';
import { Link } from "react-router-dom";

function Header() {
  return (
    <div className="header">
      <img src={Logo} />
      <div className="barra-navegacion">
        <Link to="https://microcuotas.com.ar/">
            Inicio
        </Link>
        <Link to="https://microcuotas.com.ar/#nosotros">
            Sobre nosotros
        </Link>
        <Link to="https://microcuotas.com.ar/#contacto">
            Contacto
        </Link>
      </div>
    </div>
  );
}

export default Header;
