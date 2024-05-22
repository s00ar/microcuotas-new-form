import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db, deleteDoc, fetchContactsData, logout } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { query, collection, getDocs, where, doc } from "firebase/firestore";
import '../css/Report.css';
import Logo from '../assets/logo_textoblanco_fondotransp.png';

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
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGESIZE = 10

  useEffect(() => {
    const fetchDataFromFirestore = async () => {
      try {
        const clientesCollection = collection(db, 'clientes');
        const querySnapshot = await getDocs(clientesCollection);
        const data = querySnapshot.docs.map((doc) => doc.data());
        
        if (Array.isArray(data) && data.length > 0) {
          setClientesData(data);
          setpaginatedrecords(data.slice(0, PAGESIZE));
          setTotalPages(Math.ceil(data.length / PAGESIZE));
        } else {
          console.warn('Fetched data is not a valid array or is empty.');
        }
      } catch (error) {
        console.error('Error fetching data from Firestore:', error.message);
      }
    };

    if (!loading && user) {
      fetchDataFromFirestore();
    }
  }, [loading, user]); // Include dependencies in the dependency array


  useEffect(() => {
    console.log(page)
    const min = page * PAGESIZE
    const max = (page * PAGESIZE) + PAGESIZE
    let _ = clientesData.slice(min, max)
    setpaginatedrecords(_)
    setTotalPages(Math.ceil(clientesData.length / PAGESIZE))
  }, [page, clientesData])

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
    let rows = await fetchContactsData()
    setClientesData(rows);
    setpaginatedrecords(rows.slice(0, PAGESIZE))
  };

  const getTime = (fechaSolicitud) => {
    if (fechaSolicitud && fechaSolicitud.seconds !== undefined) {
      const nanoseconds = fechaSolicitud.nanoseconds || 0;
      const fireBaseTime = new Date(fechaSolicitud.seconds * 1000 + nanoseconds / 1000000);
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
      "mail",
      "monto",
      "cuotas",
      "estadoCivil",
      "hijos",
      "ocupacion",
      "ingresoMensual",
      "fechaIngreso",
      "fechaNacimiento",
      "fechaSolicitud",
      "dniFrente",
      "dniDorso",
      "retratoDni",
      "\n"
    ]
    let csvRows = clientesData.map(e => {
      let _ = []
      _[0] = e.nombre
      _[1] = e.apellido
      _[2] = e.cuil
      _[3] = e.telefono
      _[4] = e.mail
      _[5] = e.monto
      _[6] = e.cuotas
      _[7] = `"${e.estadoCivil}"`
      _[8] = e.hijos ? e.hijos : ""
      _[9] = `"${e.ocupacion}"`
      _[10] = e.ingresoMensual
      _[11] = `"${e.fechaIngreso}"`
      _[12] = `"${e.fechaNacimiento}"`
      _[13] = getTime(e.timestamp)
      _[14] = e.dniFrente
      _[15] = e.dniDorso
      _[16] = e.retratoDni
      _[17] = "\n"
      return _
    })
    var pom = document.createElement('a');
    var blob = new Blob([header, ...csvRows], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    pom.href = url;
    pom.setAttribute('download', 'download.csv');
    pom.click();
    alert("Archivo exportado correctamente")
  }


  useEffect(() => {
    checkAuth();
  }, []);

  const filterData = async () => {
    try {
      const rows = await fetchContactsData(startDate, endDate);
      setClientesData(rows);
      setpaginatedrecords(rows);
    } catch (error) {
      console.error('Error filtering data:', error);
    }
  };

  const handleDelete = async (cuil) => {
    if (window.confirm("¿Estás seguro de eliminar este cliente?")) {
      try {
        const docRef = doc(db, "clientes", cuil);
        await deleteDoc(docRef);
        setClientesData(prevData => prevData.filter(cliente => cliente.cuil !== cuil));
        // done
        setpaginatedrecords(prevRecords => prevRecords.filter(cliente => cliente.cuil !== cuil));
        alert("Cliente eliminado correctamente");
      } catch (error) {
        console.error("Error eliminando el cliente:", error.message);
        alert("Hubo un error eliminando el cliente. Por favor, inténtalo de nuevo.");
      }
    }
  };
  
  

  const handleSortAscend = (key) => {
    //sort on basis of key
    // console.log(key)
    let _;
    // if (key === "id") {
    //   _ = [...paginatedrecords].sort((a, b) => a[key] - b[key]);
    // } else if (key === "timestamp") {
    //   _ = [...paginatedrecords].sort(
    //     (a, b) => new Date(getTime(a[key])) - new Date(getTime(b[key]))
    //   );
    // } else {
    //   _ = [...paginatedrecords].sort((a, b) => (a[key] > b[key] ? 1 : -1));
    // }

    if (key === 'nombre') {
      _ = [...paginatedrecords].sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (key === 'apellido') {
      _ = [...paginatedrecords].sort((a, b) => a.apellido.localeCompare(b.apellido));
    } else if (key === 'timestamp') {
      _ = [...paginatedrecords].sort((a, b) => getTime(a[key]) - getTime(b[key]));
    } else {
      _ = [...paginatedrecords].sort((a, b) => a[key] - b[key]);
    }


    setpaginatedrecords(_);
  };
  const handleSortDescend = (key) => {
    let _;
    if (key === "id") {
      _ = [...paginatedrecords].sort((a, b) => b[key] - a[key]);
    } else if (key === "timestamp") {
      _ = [...paginatedrecords].sort(
        (a, b) => new Date(getTime(b[key])) - new Date(getTime(a[key]))
      );
    } else {
      _ = [...paginatedrecords].sort((a, b) => (a[key] > b[key] ? -1 : 1));
    }
    setpaginatedrecords(_);
  };

  return (
    <div className="admin-background">
      <nav className="nav__container">
        <div className="innderNav">
          <div className="admin__title__card">
            <img className="admin__logo" src={Logo} />
            <h2 className="admin__title">Herramienta de Reportes</h2>
          </div>
          <div className="admin__button__container">
            <button className="btn__admin">
              <Link className="btn__admin__text" to="/login">
                Volver a login
                </Link>
            </button>
            <button className="btn__admin" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>
      <div className="main__container">
        <div className="filter__container">
          <h2>Filtro de clientes</h2>
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
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSortAscend("cuil")}>ID</th>
                <th onClick={() => handleSortAscend("nombre")}>Nombre</th>
                <th onClick={() => handleSortAscend("apellido")}>Apellido</th>
                <th onClick={() => handleSortAscend("telefono")}>Teléfono</th>
                <th onClick={() => handleSortAscend("mail")}>Mail</th>
                <th onClick={() => handleSortAscend("timestamp")}>
                  Fecha Solicitud
                </th>
                <th onClick={() => handleSortAscend("estadoCivil")}>
                  Estado Civil
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedrecords.map((cliente) => (
                <tr key={cliente.timestamp.seconds}>
                  <td>{cliente.cuil}</td>
                  <td>{cliente.nombre}</td>
                  <td>{cliente.apellido}</td>
                  <td>{cliente.telefono}</td>
                  <td>{cliente.mail}</td>
                  <td>{getDay(cliente.timestamp)}</td>
                  <td>{cliente.estadoCivil}</td>
                  <td>
                    <button
                      className="btn__delete"
                      onClick={() => handleDelete(cliente.cuil)}
                    >
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
            onClick={() => setPage(page - 1)}>Anterior</button>
            <span>Página {page + 1} de {totalPages}</span>
            <button
              disabled={page === Math.ceil(clientesData.length / PAGESIZE) - 1}
              onClick={() => setPage(page + 1)}
            >Siguiente</button>
          </div>
        </div>
        <button className="btn__export" onClick={toExport}>
          Exportar a CSV
        </button>
      </div>
    </div>
  );
}
