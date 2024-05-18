import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Reset from "./pages/Reset";
import Register from "./pages/Register";
import Report from "./pages/Report";
import Verification from "./pages/Verification";
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
            <Route exact path="/" element={<Verification/>} />
            <Route path="/clientform" element={<ClientForm cuil={cuil} />} /> {/* Pass cuil as a prop */}
            <Route exact path="/login" element={<Login />} />
            <Route exact path="/reset" element={<Reset />} />
            <Route exact path="/register" element={<Register />} />
            <Route exact path="/report" element={<Report />} />
          </Routes>
        </Router>
        </div>
    </div>
  );
};

export default App;