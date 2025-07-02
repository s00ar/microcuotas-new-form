import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Logo from '../assets/logo_textoblanco_fondotransp.png';
import '../css/Header.css';
import { auth, logout } from "../firebase";
import { useAuthState } from 'react-firebase-hooks/auth'

function Header() {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();

  const handleLogout = async () => {
      try {
      await logout();
      navigate("/login", { replace: true });
      } catch (err) {
      console.error("Error al cerrar sesión:", err);
      }
  };
return (
<div className="header">
    <img className="admin__logo" src={Logo} />
      <div className="barra-navegacion">        
        {/* if the user is logged show logout if not show show login */}
            {user ? (
                <>
                <div className='header__button'>
                    <Link to="/login">
                        <button className='header__button'>
                        Estadisticas
                        </button>
                    </Link>
                    <Link to="/report">
                        <button>
                        Reportes
                        </button>
                    </Link>
                </div>
                    <Link to="/options">
                        <button className='header__button'>
                        Opciones del sistema
                        </button>
                    </Link>
                    <br/>
                    <button
                    onClick={handleLogout}
                    className='header__button'
                    >
                    Salir
                    </button>
                </>
            ) : (
                <>

                    <Link to="/login">
                        Ingresar al sistema
                    </Link>
                </>
            )}
      </div>
    </div>
  );
}

export default Header;
