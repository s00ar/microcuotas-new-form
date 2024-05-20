import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db, fetchContactsData, logout } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { query, collection, getDocs, where } from "firebase/firestore";
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
  const PAGESIZE = 10

  useEffect(() => {
    const fetchDataFromFirestore = async () => {
      try {
        const clientesCollection = collection(db, 'clientes');
        const querySnapshot = await getDocs(clientesCollection);
        const data = querySnapshot.docs.map((doc) => doc.data());
        setClientesData(data);
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
  }, [page])

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
    const min = page * PAGESIZE;
    const max = page * PAGESIZE + PAGESIZE;
    let _ = clientesData.slice(min, max);
    setpaginatedrecords(_);
  }, [page]);

  useEffect(() => {
    checkAuth();
  }, []);
  //TEST THIS INSTEAD

  // useEffect(() => {
  //   if (loading) return;
  //   checkAuth();
  //   // enter()
  // }, [user, loading]);

  const filterData = async () => {
    try {
      const rows = await fetchContactsData(startDate, endDate);
      setClientesData(rows);
      setpaginatedrecords(rows);
    } catch (error) {
      console.error('Error filtering data:', error);
    }
  };

  const handleSortAscend = (key) => {
    //sort on basis of key
    let _;
    if (key === "id") {
      _ = [...paginatedrecords].sort((a, b) => a[key] - b[key]);
    } else if (key === "timestamp") {
      _ = [...paginatedrecords].sort(
        (a, b) => new Date(getTime(a[key])) - new Date(getTime(b[key]))
      );
    } else {
      _ = [...paginatedrecords].sort((a, b) => (a[key] > b[key] ? 1 : -1));
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
            <button className="btn__admin">
              <a className="btn__admin__text" onClick={logout} href="/login">
                Salir
              </a>
            </button>
          </div>
        </div>
      </nav>

      <div className="filter__field__container">
        <div className="filter__field">
          <div>
            <span>
              Fecha inicial: <input type={"date"} value={startDate} onChange={e => setStartDate(e.target.value)} />
              Fecha Final: <input type={"date"} value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button onClick={filterData}>filter</button>
            </span>
          </div>
          <div>
            <button disabled={clientesData.length === 0} onClick={toExport}>Exportar CSV</button>
          </div>
        </div>
      </div>
      <div className="filter__field__container">
        <table style={{
          borderCollapse: "collapse",
          width: "70%"
        }}>
          <thead>
            <tr style={{
              borderBottom: "1px solid black"
            }}>
              <th>
                <div style={headerStyle}>
                  <div>
                      Nombre
                  </div>
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  <div>
                      Apellido
                  </div>
                </div>
              </th>
              <th style={{ padding: "1px" }}>Cuil</th>
              <th>
                <div style={headerStyle}>
                  <div>
                    Teléfono
                  </div>
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  <div>
                      Email
                  </div>
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  <div>
                      Monto
                  </div>
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  <div>
                      Cuotas
                  </div>
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  Ingreso mensual
                </div>
              </th>
              <th style={{ padding: "10px" }}>Fecha de Ingreso</th>
              <th style={{ padding: "10px" }}>Estado civil</th>
              <th>
                <div style={headerStyle}>
                  Profesión
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  Hijos
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  Fecha de nacimiento
                </div>
              </th>
              <th>
                <div style={headerStyle}>
                  Fecha de carga
                </div>
              </th>
              <th style={{ padding: "10px" }}>DNI Frente</th>
              <th style={{ padding: "10px" }}>DNI Dorso</th>
              <th>
                <div style={headerStyle}>
                  Retrato + DNI
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {clientesData.map((e, index) => (
              <tr key={index} style={{ borderBottom: "1px solid black" }}>
                <td style={{ padding: "10px" }}>{e.nombre}</td>
                <td style={{ padding: "10px" }}>{e.apellido}</td>
                <td style={{ padding: "10px" }}>{e.cuil}</td>
                <td style={{ padding: "10px" }}>{e.telefono}</td>
                <td style={{ padding: "10px" }}>{e.mail}</td>
                <td style={{ padding: "10px" }}>{e.monto}</td>
                <td style={{ padding: "10px" }}>{e.cuotas}</td>
                <td style={{ padding: "10px" }}>{e.ingresoMensual}</td>
                <td style={{ padding: "10px" }}>{e.fechaIngreso}</td>
                <td style={{ padding: "10px" }}>{e.estadoCivil}</td>
                <td style={{ padding: "10px" }}>{e.ocupacion}</td>
                <td style={{ padding: "10px" }}>{e.hijos === "true" ? "si" : "no"}</td>
                <td style={{ padding: "10px" }}>{e.fechaNacimiento}</td>
                <td style={{ padding: "10px" }}>{e.fechaSolicitud}</td>
                <td style={{ padding: "10px" }}>
                  <a target="_blank" href={e.dniFrente}>DNI Frente</a>
                </td>
                <td style={{ padding: "10px" }}>
                  <a target="_blank" href={e.dniDorso}>DNI Dorso</a>
                </td>
                <td style={{ padding: "10px" }}>
                  <a target="_blank" href={e.retratoDni}>Retrato + DNI</a>
                </td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>
      <br />
      <div style={{
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{
          width: "80%",
          display: "flex",
          justifyContent: "end"
        }} >
          <div>
            <button
              disabled={page <= 0}
              onClick={() => {
                setPage(page - 1 <= 0 ? 0 : page - 1)
              }}>
              Ant
            </button>
            <button disabled={
              (page + 1) * PAGESIZE >= clientesData.length
            } onClick={() => {
              setPage(page + 1)
            }}>Prev</button>
          </div>
        </div>
      </div>
      {show && (
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.5)",
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "10px",
              maxWidth: "80%",
              maxHeight: "80%",
              overflow: "auto",
            }}
          >
            <h1>{selected.nombre}</h1>
            <p>Teléfono: {selected.telefono}</p>
            <p>Ingreso: {selected.cuil}</p>
            <a href={`mailto:${selected.correo}`}>Correo electrónico</a><br />
            <p>DNI Frente</p>
            <img src={`data:image/png;base64, ${selected.dniFrente}`} alt="DNI" />
            <p>DNI Dorso</p>
            <img src={`data:image/png;base64, ${selected.dniDorso}`} alt="DNI" />
            <p>Retrato con DNI</p>
            <img src={`data:image/jpeg;base64, ${selected.retratoDni}`} alt="Retrato+DNI" />
            <button onClick={() => setShow(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}