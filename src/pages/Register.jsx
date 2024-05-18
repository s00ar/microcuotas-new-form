import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { Link, useNavigate } from "react-router-dom";
import {
auth,
registerWithEmailAndPassword,
db,
fetchContactsData
} from "../firebase";
import { query, collection, getDocs, where } from "firebase/firestore";
import "../css/Register.css";

function Register() {
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [name, setName] = useState("");
const [user, loading, error] = useAuthState(auth);
const [role, setRole] = useState(""); // default role is user
const [isPasswordSecure, setIsPasswordSecure] = useState(false);
const [disabled, setDisabled] = useState(true);

const register = () => {
  if (!name) {
    alert("Ingrese su nombre");
    return;
  }
  if (!email) {
    alert("Ingrese su correo electrónico");
    return;
  }
  if (!role) {
    alert("Seleccione un rol");
    return;
  }
  if (!password) {
    alert("Ingrese una contraseña");
    return;
  }
  if (password.length < 8) {
    alert("La contraseña debe tener al menos 8 caracteres");
    return;
  }
  if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W)/.test(password)) {
    alert(
      "La contraseña debe contener al menos un número, una letra mayúscula, una letra minúscula y un carácter especial"
    );
    return;
  } else {
      registerWithEmailAndPassword(name, email, password, role)
          .then(() => {
            setName("");
            setPassword("");
            setEmail("");
            setRole("");
          })
          .then(()=>{
            alert("✔");
          }
          )
          .catch((error) => {
              alert("Error al crear usuario: " + error.message);
          });
  }
};

  
const navigate = useNavigate();


const checkAuth = async () => {
    if (!user) return navigate("/login");

    const uid = user && user.uid;
    const q = query(collection(db, "users"), where("uid", "==", uid));
    const doc = await getDocs(q);
     const data = [];
     doc.forEach((doc) => {
       data.push(doc.data());
     });
    if (!data.role === "admin") return navigate("/login");
    let rows = await fetchContactsData()
  };

  useEffect(() => {
    checkAuth();
  }, []);
  useEffect(() => {
    if (name && email && password && role && isPasswordSecure) {
    setDisabled(false);
    } else {
    setDisabled(true);
    }
    }, [name, email, password, role, isPasswordSecure]);

  const validatePassword = (password) => {
    const regex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;
    setIsPasswordSecure(regex.test(password));
    if (!regex.test(password) || !name || !email || !role) {
      setDisabled(true);
    } else {
      setDisabled(false);
    }
  }
  
return (
    <div className="container">
        <nav style={{ backgroundColor: "dark", color: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px" }}>
            <div className="admin-title-card">
            <h1 className="admin-title"> Criss Assist</h1>

            <h2 className="admin-title2">Herramienta de Reportes</h2>
            </div>
        <button className="btn-admin">
            <Link className="btn-admin-text" to="/dashboard">
                <h3>
                INICIAR FORMULARIO
                </h3>
            </Link>
            </button>
            <button className="btn-admin">
            <Link className="btn-admin-text" to="/admin">
                <h3>
                REPORTES
                </h3>
            </Link>
            </button>
            <button className="btn-admin" onClick={() => auth.signOut()}>
                <h3 className="btn-admin-text">
                    SALIR
                </h3>
            </button>
        </div>
        </nav>
    <div className="register">
    <div className="register__container">
        <input
            type="text"
            className="register__textBox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre completo"
            required
        />
        <input
            type="email" // Utiliza el tipo de entrada de correo electrónico
            className="register__textBox"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Casilla de e-mail"
            required // Requiere que el campo esté lleno
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$" // Requiere un formato de correo electrónico válido
        />

        <select
            className="register__textBox"
            id="role" 
            name="role" 
            onChange={(e) => setRole(e.target.value)}>
                <option value="">Seleccionar rol</option>
                <option value="report">Reportes</option>
                <option value="admin">Administrador</option>
                <option value="user">Usuario</option>
        </select>
        <input
            type="password"
            className="register__textBox"
            value={password}
            onChange={(e) => {
                setPassword(e.target.value);
                validatePassword(e.target.value);
            }}
            placeholder="Contraseña"
            minLength={8}
            required
            title="La contraseña debe tener al menos 8 caracteres, incluyendo al menos un número, una letra mayúscula, una letra minúscula y un carácter especial."
            />


        <button className="register__btn" disabled={disabled} onClick={register}>
        Crear usuario
        </button>
        {isPasswordSecure ? (
            <p className="register__helpText register__helpText--success">✔ La contraseña es segura.</p>
            ) : (
            <p className="register__helpText register__helpText--error">❌ La contraseña debe tener al menos 8 caracteres.
            <br/> ◽ Incluyendo al menos un número.<br/> ◽ Una letra mayúscula.<br/> ◽ Una letra minúscula. <br/> ◽ Un carácter especial.</p>
            )}

        </div>
    </div>
    </div>
);
}
export default Register;
