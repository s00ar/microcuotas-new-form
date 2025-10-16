// src/pages/Login.jsx

import React, { useState, useEffect } from "react"; 
import { Link } from "react-router-dom";
import { auth, logInWithEmailAndPassword, db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import "../css/Login.css";
import Banner from "../components/Header-Loged";
import DashboardCharts from "../components/DashboardCharts";
import { useGlobalLoadingEffect } from "../components/GlobalLoadingProvider";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user] = useAuthState(auth);

  // 1) Estados para la lista de clientes y su carga
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  useGlobalLoadingEffect(loadingClients);

  // 2) Efecto que suscribe a Firestore cuando el usuario está logueado
  useEffect(() => {
    if (!user) return;

    setLoadingClients(true);
    const colRef = collection(db, "clientes");           // o la colección que uses
    const q = query(colRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const docs = snapshot.docs.map(doc => doc.data());
        setClients(docs);
        setLoadingClients(false);
      },
      err => {
        console.error("Error en onSnapshot:", err);
        setLoadingClients(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 3) Tu Dashboard usando los nuevos estados
  const Dashboard = () => (
    <div className="dashboard">
      <h2>Estadísticas de Clientes</h2>

      {loadingClients ? (
        <p>Cargando clientes…</p>
      ) : (
        <>
          <p>
            <strong>Total de clientes:</strong> {clients.length}
          </p>
          <DashboardCharts clients={clients} />
        </>
      )}
    </div>
  );

  // 4) Renderizado condicional
  return (
    <div>
      <div className="banner__container">
        <Banner />
      </div>
    <div className="admin__title__card">
        <h2 className="admin__title">Estádisticas de sistema</h2>
    </div>
      <div className="login">
        <div className="login__container">
          {user ? (
            <Dashboard />
          ) : (
            <div className="login__form">
              <input
                type="text"
                className="login__textBox"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail Address"
              />
              <input
                type="password"
                className="login__textBox"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                className="login__btn"
                onClick={() => logInWithEmailAndPassword(email, password)}
              >
                Ingresar
              </button>
              <div>
                <Link to="/reset">
                  <button className="login__btn">
                    Olvidé mi contraseña
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
