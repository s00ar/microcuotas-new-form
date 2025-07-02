import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router-dom";
import { auth, sendPasswordResetEmail } from "../firebase";
import "../css/Reset.css";
import Banner from "../components/Header-Loged";

function Reset() {
const [email, setEmail] = useState("");
const [user, loading] = useAuthState(auth);
const navigate = useNavigate();
useEffect(() => {
    if (loading) return;
    if (user) navigate("/dashboard");
}, [user, loading]);
return (
    <>
        <div className="banner__container">
            <Banner />
        </div>
    <div className="reset">
        <div className="reset__container">
            <input
            type="text"
            className="reset__textBox"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Dirección de correo electrónico"
            />
            <button
            className="reset__btn"
            onClick={() => sendPasswordResetEmail(email)}
            >
            Enviar correo para restablecer contraseña
            </button>
            {/* <div>
            Don't have an account? <Link to="/register">Register</Link> now.
            </div> */}
        </div>
    </div>
</>
);
}
export default Reset;