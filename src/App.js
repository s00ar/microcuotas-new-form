import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Reset from "./pages/Reset";
import Register from "./pages/Register";
import Report from "./pages/Report";
import Paso1 from "./pages/Paso1";
import Paso2 from "./pages/Paso2";
import Paso3 from "./pages/Paso3";
import ClientForm from './pages/ClientForm';
import './css/App.css';
import firebaseApp from "./firebase";

const App = () => {
  const [cuil, setCuil] = useState("");


  return (
    <div>
    <div className="App">
        <Router basename={process.env.PUBLIC_URL}>
          <Routes>
            <Route path="/paso1" element={<Paso1 />} />
            <Route path="/paso2" element={<Paso2 />} />
            <Route path="/paso3" element={<Paso3 />} />
            <Route path="/clientform" element={<ClientForm cuil={cuil} />} /> {/* Pass cuil as a prop */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/register" element={<Register />} />
            <Route path="/report" element={<Report />} />
            <Route path="/" element={<Paso1 />} />
          </Routes>
        </Router>
        </div>
    </div>
  );
};

export default App;
