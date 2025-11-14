import React from 'react';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Reset from "./pages/Reset";
import Register from "./pages/Register";
import Report from "./pages/Report";
import Paso1 from "./pages/Paso1";
import Paso2 from "./pages/Paso2";
import Paso3 from "./pages/Paso3";
import Paso4 from "./pages/Paso4";
import Paso5 from "./pages/Paso5";
import RechazoNombre from "./pages/Rechazo-nombre";
import SolicitudExitosa from "./pages/SolicitudExitosa";
import ClientForm from './pages/ClientForm';
import Options from "./pages/Options";
import './css/App.css';
import firebaseApp from "./firebase";
import FooterBar from "./components/Footer";
import { GlobalLoadingProvider } from "./components/GlobalLoadingProvider";

const App = () => {
  return (
    <div>
      <div className="App">
        <GlobalLoadingProvider>
          <Router basename={process.env.PUBLIC_URL}>
            <Routes>
              <Route path="/paso1" element={<Paso1 />} />
              <Route path="/paso2" element={<Paso2 />} />
              <Route path="/paso3" element={<Paso3 />} />
              <Route path="/paso4" element={<Paso4 />} />
              <Route path="/paso5" element={<Paso5 />} />
              <Route path="/rechazo-nombre" element={<RechazoNombre />} />
              <Route path="/solicitud-exitosa" element={<SolicitudExitosa />} />
              <Route path="/clientform" element={<ClientForm />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset" element={<Reset />} />
              <Route path="/register" element={<Register />} />
              <Route path="/report" element={<Report />} />
              <Route path="/options" element={<Options />} />
              <Route path="/" element={<Paso1 />} />
            </Routes>
          </Router>
        </GlobalLoadingProvider>
      </div>
      <FooterBar />
    </div>
  );
};

export default App;





