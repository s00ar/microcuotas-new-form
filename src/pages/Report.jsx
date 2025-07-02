import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db, deleteDoc, fetchContactsData, logout } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { query, collection, getDocs, where, doc } from "firebase/firestore";
import "../css/Report.css";
import Logo from "../assets/logo_textoblanco_fondotransp.png";
import Banner from "../components/Header-Loged";

const iconStyle = {
  cursor: "pointer",
};

const headerStyle = {
  padding: "10px",
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
};

export default function Admin() {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const [clientesData, setClientesData] = useState([]);
  const [paginatedrecords, setpaginatedrecords] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortMethod, setSortMethod] = useState(""); // New state for sorting method
  const PAGESIZE = 10;

  useEffect(() => {
    const fetchDataFromFirestore = async () => {
      try {
        const clientesCollection = collection(db, "clientes");
        const querySnapshot = await getDocs(clientesCollection);
        const data = querySnapshot.docs.map((doc) => doc.data());

        if (Array.isArray(data) && data.length > 0) {
          setClientesData(data);
          setpaginatedrecords(data.slice(0, PAGESIZE));
          setTotalPages(Math.ceil(data.length / PAGESIZE));
        } else {
          console.warn("Fetched data is not a valid array or is empty.");
        }
      } catch (error) {
        console.error("Error fetching data from Firestore:", error.message);
      }
    };

    if (!loading && user) {
      fetchDataFromFirestore();
    }
  }, [loading, user]);

  useEffect(() => {
    const min = page * PAGESIZE;
    const max = page * PAGESIZE + PAGESIZE;
    let _ = clientesData.slice(min, max);
    setpaginatedrecords(_);
    setTotalPages(Math.ceil(clientesData.length / PAGESIZE));
  }, [page, clientesData]);

  const checkAuth = async () => {
    if (!user) return navigate("/login");
    if (user) return navigate("/report");

    const uid = user && user.uid;
    const q = query(collection(db, "users"), where("uid", "==", uid));
    const doc = await getDocs(q);
    const data = [];
    doc.forEach((doc) => {
      data.push(doc.data());
    });
    let rows = await fetchContactsData();
    setClientesData(rows);
    setpaginatedrecords(rows.slice(0, PAGESIZE));
  };

  const getTime = (fechaSolicitud) => {
    if (fechaSolicitud && fechaSolicitud.seconds !== undefined) {
      const nanoseconds = fechaSolicitud.nanoseconds || 0;
      const fireBaseTime = new Date(
        fechaSolicitud.seconds * 1000 + nanoseconds / 1000000
      );
      return fireBaseTime;
    } else {
      return null;
    }
  };

  const getDay = (fechaSolicitud) => {
    const fireBaseTime = new Date(
      fechaSolicitud.seconds * 1000 + fechaSolicitud.nanoseconds / 1000000
    );
    const date = fireBaseTime.toDateString();
    return date;
  };

  const toExport = () => {
    let header = [
      "nombre",
      "apellido",
      "cuil",
      "telefono",
      "monto",
      "cuotas",
      "ingresoMensual",
      "fechaIngreso",
      "fechaSolicitud",
      "\n",
    ];
    let csvRows = clientesData.map((e) => {
      let _ = [];
      _[0] = e.nombre;
      _[1] = e.apellido;
      _[2] = e.cuil;
      _[3] = e.telefono;
      _[4] = e.monto;
      _[5] = e.cuotas;
      _[6] = e.ingresoMensual;
      _[7] = `"${e.fechaIngreso}"`;
      _[8] = getTime(e.timestamp);
      _[9] = "\n";
      return _;
    });
    var pom = document.createElement("a");
    var blob = new Blob([header, ...csvRows], {
      type: "text/csv;charset=utf-8;",
    });
    var url = URL.createObjectURL(blob);
    pom.href = url;
    pom.setAttribute("download", "download.csv");
    pom.click();
    alert("Archivo exportado correctamente");
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const filterData = async () => {
    try {
      const rows = await fetchContactsData(startDate, endDate);
      console.log(startDate, endDate);
      setClientesData(rows);
      setpaginatedrecords(rows);
    } catch (error) {
      console.error("Error filtering data:", error);
    }
  };

  const handleDelete = async (cuil) => {
    if (window.confirm("¿Estás seguro de eliminar este cliente?")) {
      try {
        const docRef = doc(db, "clientes", cuil);
        await deleteDoc(docRef);
        setClientesData((prevData) =>
          prevData.filter((cliente) => cliente.cuil !== cuil)
        );
        setpaginatedrecords((prevRecords) =>
          prevRecords.filter((cliente) => cliente.cuil !== cuil)
        );
        alert("Cliente eliminado correctamente");
      } catch (error) {
        console.error("Error eliminando el cliente:", error.message);
        alert(
          "Hubo un error eliminando el cliente. Por favor, inténtalo de nuevo."
        );
      }
    }
  };

  const updatePaginatedRecords = (sortedData, newPage = 0) => {
    setPage(newPage);
    const start = newPage * PAGESIZE;
    const end = start + PAGESIZE;
    setClientesData(sortedData); // Update the main data with sorted data
    setpaginatedrecords(sortedData.slice(start, end));
  };

  const sortByIdAscend = () => {
    const sortedData = [...clientesData].sort((a, b) =>
      a.cuil.localeCompare(b.cuil)
    );
    updatePaginatedRecords(sortedData);
    setSortMethod("sortByIdAscend");
  };

  const sortByNombreAscend = () => {
    const sortedData = [...clientesData].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
    updatePaginatedRecords(sortedData);
    setSortMethod("sortByNombreAscend");
  };

  const sortByApellidoAscend = () => {
    const sortedData = [...clientesData].sort((a, b) =>
      a.apellido.localeCompare(b.apellido)
    );
    updatePaginatedRecords(sortedData);
    setSortMethod("sortByApellidoAscend");
  };

  const sortByTelefonoAscend = () => {
    const sortedData = [...clientesData].sort((a, b) =>
      a.telefono.localeCompare(b.telefono)
    );
    updatePaginatedRecords(sortedData);
    setSortMethod("sortByTelefonoAscend");
  };

  const sortByFechaSolicitudAscend = () => {
    const sortedData = [...clientesData].sort(
      (a, b) => getTime(a.timestamp) - getTime(b.timestamp)
    );
    updatePaginatedRecords(sortedData);
    setSortMethod("sortByFechaSolicitudAscend");
  };

  // create the sort method as to sort descending date
  const sortByFechaSolicitudDescend = () => {
    const sortedData = [...clientesData].sort(
      (a, b) => getTime(b.timestamp) - getTime(a.timestamp)
    );
    updatePaginatedRecords(sortedData);
    setSortMethod("sortByFechaSolicitudDescend");
  };

  return (
    <div className="admin-background">
        <div className="banner__container">
            <Banner />
        </div>
      <nav className="nav__container">
        <div className="innderNav">
          <div className="admin__title__card">
            <h2 className="admin__title">Herramienta de Reportes</h2>
          </div>
        </div>
      </nav>
      <div className="main__container">
        <div className="filter__container">
          <h2>Filtro entradas por fecha</h2>
          <div className="input__container">
            <input
              className="input__field"
              type="date"
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span>-</span>
            <input
              className="input__field"
              type="date"
              onChange={(e) => setEndDate(e.target.value)}
            />
            <button className="btn__buscar" onClick={filterData}>
              Buscar
            </button>
          </div>
        </div>
        <div className="table__container">
          <h6>Clickea en cada encabezado para ordenarlo por ese valor</h6>
          <table>
            <thead>
              <tr>
                <th onClick={sortByIdAscend}>ID</th>
                <th onClick={sortByNombreAscend}>Nombre</th>
                <th onClick={sortByApellidoAscend}>Apellido</th>
                <th onClick={sortByTelefonoAscend}>Telefono</th>
                <th onClick={sortByFechaSolicitudDescend}>Fecha Solicitud</th>
                <th>Borrar entrada</th>
              </tr>
            </thead>
            <tbody>
              {paginatedrecords.map((cliente, index) => (
                <tr key={index}>
                  <td>{cliente.cuil}</td>
                  <td>{cliente.nombre}</td>
                  <td>{cliente.apellido}</td>
                  <td>{cliente.telefono}</td>
                  <td>{getDay(cliente.timestamp)}</td>
                  <td>
                    <button onClick={() => handleDelete(cliente.cuil)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination-container">
            <button
              disabled={page === 0}
              onClick={() => updatePaginatedRecords(clientesData, page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <button
              disabled={page === Math.ceil(clientesData.length / PAGESIZE) - 1}
              onClick={() => updatePaginatedRecords(clientesData, page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
        <button className="btn__export" onClick={toExport}>
          Exportar a CSV
        </button>
      </div>
    </div>
  );
}
