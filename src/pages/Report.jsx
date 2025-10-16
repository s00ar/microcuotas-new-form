import React, { useEffect, useMemo, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db, deleteDoc, fetchContactsData, logout } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { query, collection, getDocs, where, doc } from "firebase/firestore";
import "../css/Report.css";
import Logo from "../assets/logo_textoblanco_fondotransp.png";
import { useGlobalLoadingEffect } from "../components/GlobalLoadingProvider";

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

const normalizeText = (value) => String(value || "").toLowerCase().trim();

const COLUMN_FILTER_DEFAULTS = Object.freeze({
  cuil: "todos",
  nombre: "todos",
  apellido: "todos",
  telefono: "todos",
  fecha: "todos",
});

export default function Admin() {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const [fullClientesData, setFullClientesData] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortMethod, setSortMethod] = useState(""); // New state for sorting method
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [motivoFiltro, setMotivoFiltro] = useState("todos");
  const [columnFilters, setColumnFilters] = useState(() => ({ ...COLUMN_FILTER_DEFAULTS }));
  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);

  useGlobalLoadingEffect(loading || isLoadingData);

  useEffect(() => {
    const fetchDataFromFirestore = async () => {
      setIsLoadingData(true);
      try {
        const clientesCollection = collection(db, "clientes");
        const querySnapshot = await getDocs(clientesCollection);
        const data = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setFullClientesData(data);
        setPage(0);
      } catch (error) {
        console.error("Error fetching data from Firestore:", error.message);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (!loading && user) {
      fetchDataFromFirestore();
    }
  }, [loading, user]);

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
    setIsLoadingData(true);
    try {
      let rows = await fetchContactsData();
      setFullClientesData(rows);
      setPage(0);
    } finally {
      setIsLoadingData(false);
    }
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
    const fireBaseTime = getTime(fechaSolicitud);
    if (!fireBaseTime) {
      return "";
    }
    return fireBaseTime.toDateString();
  };

  const toExport = () => {
    let header = [
      "nombre",
      "apellido",
      "cuil",
      "telefono",
      "email",
      "monto",
      "cuotas",
      "estado",
      "motivoRechazo",
      "motivoRechazoCodigo",
      "resultadoEvaluacionCodigo",
      "resultadoEvaluacionDescripcion",
      "ingresoMensual",
      "fechaIngreso",
      "fechaSolicitud",
      "\n",
    ];
    let csvRows = fullClientesData.map((e) => {
      let _ = [];
      _[0] = e.nombre;
      _[1] = e.apellido;
      _[2] = e.cuil;
      _[3] = e.telefono;
      _[4] = e.email || "";
      _[5] = e.monto;
      _[6] = e.cuotas;
      _[7] = e.estado || "";
      _[8] = e.motivoRechazo || "";
      _[9] = e.motivoRechazoCodigo || "";
      _[10] = e.ingresoMensual || "";
      _[11] = e.fechaIngreso ? `"${e.fechaIngreso}"` : "";
      const fecha = getTime(e.timestamp);
      _[12] = fecha ? fecha.toISOString() : "";
      _[13] = "\n";
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

  const handleBusquedaChange = (event) => {
    const value = event.target.value;
    setBusquedaGeneral(value);
    setPage(0);
  };

  const handleClearBusqueda = () => {
    setBusquedaGeneral("");
    setPage(0);
  };

  const filterData = async () => {
    setIsLoadingData(true);
    try {
      const rows = await fetchContactsData(startDate, endDate);
      setFullClientesData(rows);
      setPage(0);
    } catch (error) {
      console.error("Error filtering data:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (window.confirm("Estas seguro de eliminar este registro?")) {
      setIsLoadingData(true);
      try {
        const docRef = doc(db, "clientes", recordId);
        await deleteDoc(docRef);
        const updatedFull = fullClientesData.filter((cliente) => cliente.id !== recordId);
        setFullClientesData(updatedFull);
        setPage((prev) =>
          Math.max(0, Math.min(prev, Math.ceil((updatedFull.length || 0) / pageSize) - 1))
        );
        alert("Registro eliminado correctamente");
      } catch (error) {
        console.error("Error eliminando el cliente:", error.message);
        alert("Hubo un error eliminando el cliente. Por favor volve a intentarlo.");
      } finally {
        setIsLoadingData(false);
      }
    }
  };

  const sorters = {
    sortByIdAscend: (a, b) => String(a.cuil || "").localeCompare(String(b.cuil || "")),
    sortByNombreAscend: (a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")),
    sortByApellidoAscend: (a, b) => String(a.apellido || "").localeCompare(String(b.apellido || "")),
    sortByTelefonoAscend: (a, b) => String(a.telefono || "").localeCompare(String(b.telefono || "")),
    sortByFechaSolicitudAscend: (a, b) => (getTime(a.timestamp) || 0) - (getTime(b.timestamp) || 0),
    sortByFechaSolicitudDescend: (a, b) => (getTime(b.timestamp) || 0) - (getTime(a.timestamp) || 0),
  };

  const filteredData = useMemo(() => {
    let filtered = Array.isArray(fullClientesData) ? [...fullClientesData] : [];

    if (estadoFiltro !== "todos") {
      filtered = filtered.filter((cliente) =>
        estadoFiltro === "aceptada" ? cliente.estado === "aceptada" : cliente.estado === "rechazada"
      );
    }

    if (motivoFiltro !== "todos") {
      const normalizedFilter = normalizeText(motivoFiltro || "");
      filtered = filtered.filter((cliente) => {
        const codigo = (cliente.resultadoEvaluacionCodigo ?? cliente.motivoRechazoCodigo ?? "").toString();
        const descripcion = cliente.resultadoEvaluacionDescripcion || cliente.motivoRechazo || "";
        const normalizedDescripcion = normalizeText(descripcion);
        const codeMatches = codigo && motivoFiltro === codigo;
        const descriptionMatches = normalizedFilter && normalizedFilter === normalizedDescripcion;
        return codeMatches || descriptionMatches;
      });
    }

    if (columnFilters.cuil && columnFilters.cuil !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.cuil || "") === columnFilters.cuil);
    }

    if (columnFilters.nombre && columnFilters.nombre !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.nombre || "") === columnFilters.nombre);
    }

    if (columnFilters.apellido && columnFilters.apellido !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.apellido || "") === columnFilters.apellido);
    }

    if (columnFilters.telefono && columnFilters.telefono !== "todos") {
      filtered = filtered.filter((cliente) => String(cliente.telefono || "") === columnFilters.telefono);
    }

    if (columnFilters.fecha && columnFilters.fecha !== "todos") {
      filtered = filtered.filter((cliente) => getDay(cliente.timestamp) === columnFilters.fecha);
    }

    const normalizedSearch = normalizeText(busquedaGeneral);
    if (normalizedSearch) {
      filtered = filtered.filter((cliente) => {
        const values = [
          cliente.cuil,
          cliente.nombre,
          cliente.apellido,
          cliente.telefono,
          cliente.email,
          cliente.estado,
          cliente.motivoRechazo,
          cliente.motivoRechazoCodigo,
          cliente.resultadoEvaluacionDescripcion,
          cliente.resultadoEvaluacionCodigo,
          cliente.cuotas,
          cliente.monto,
          getDay(cliente.timestamp),
        ];
        return values.some((value) => normalizeText(value).includes(normalizedSearch));
      });
    }

    const sorter = sortMethod && sorters[sortMethod];
    return sorter ? [...filtered].sort(sorter) : filtered;
  }, [fullClientesData, estadoFiltro, motivoFiltro, columnFilters, busquedaGeneral, sortMethod]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((filteredData.length || 0) / pageSize)),
    [filteredData.length, pageSize]
  );

  const paginatedrecords = useMemo(() => {
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, totalPages, pageSize]);

  useEffect(() => {
    const safePage = Math.min(page, totalPages - 1);
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, totalPages]);

  const applySortAndFilters = (method) => {
    setSortMethod(method);
    setPage(0);
  };

  const sortByIdAscend = () => applySortAndFilters("sortByIdAscend");

  const sortByNombreAscend = () => applySortAndFilters("sortByNombreAscend");

  const sortByApellidoAscend = () => applySortAndFilters("sortByApellidoAscend");

  const sortByTelefonoAscend = () => applySortAndFilters("sortByTelefonoAscend");

  const sortByFechaSolicitudAscend = () => applySortAndFilters("sortByFechaSolicitudAscend");

  const sortByFechaSolicitudDescend = () => applySortAndFilters("sortByFechaSolicitudDescend");

  const goToPage = (targetPage) => {
    const safeTarget = Math.max(0, Math.min(targetPage, totalPages - 1));
    setPage(safeTarget);
  };

  const handlePageSizeChange = (event) => {
    const value = Number(event.target.value) || 10;
    setPageSize(value);
    setPage(0);
  };

  const estadoOptions = [
    { value: "todos", label: "Todos los estados" },
    { value: "aceptada", label: "Solicitudes aceptadas" },
    { value: "rechazada", label: "Solicitudes rechazadas" },
  ];

  const columnOptions = useMemo(() => {
    const sets = {
      cuil: new Set(),
      nombre: new Set(),
      apellido: new Set(),
      telefono: new Set(),
      fecha: new Set(),
    };

    fullClientesData.forEach((cliente) => {
      if (cliente.cuil) {
        sets.cuil.add(String(cliente.cuil));
      }
      if (cliente.nombre) {
        sets.nombre.add(String(cliente.nombre));
      }
      if (cliente.apellido) {
        sets.apellido.add(String(cliente.apellido));
      }
      if (cliente.telefono) {
        sets.telefono.add(String(cliente.telefono));
      }
      const fecha = getDay(cliente.timestamp);
      if (fecha) {
        sets.fecha.add(fecha);
      }
    });

    const toSortedArray = (set) => Array.from(set).sort((a, b) => a.localeCompare(b));

    return {
      cuil: toSortedArray(sets.cuil),
      nombre: toSortedArray(sets.nombre),
      apellido: toSortedArray(sets.apellido),
      telefono: toSortedArray(sets.telefono),
      fecha: toSortedArray(sets.fecha),
    };
  }, [fullClientesData]);

  const motivoOptions = useMemo(() => {
    const seen = new Map();

    fullClientesData.forEach((cliente) => {
      const codigo = (cliente.resultadoEvaluacionCodigo ?? cliente.motivoRechazoCodigo ?? "").toString();
      const descripcionBase =
        cliente.resultadoEvaluacionDescripcion ||
        cliente.motivoRechazo ||
        (cliente.estado === "aceptada" ? "Procesamiento satisfactorio" : "Motivo no informado");
      const descripcion = descripcionBase || "Motivo no informado";
      const normalizedDescripcion = normalizeText(descripcion);
      const hasCodigo = codigo && !["", "null", "undefined"].includes(codigo);
      const value = hasCodigo ? codigo : (normalizedDescripcion || descripcion);
      if (!seen.has(value)) {
        seen.set(value, descripcion);
      }
    });

    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [fullClientesData]);

  const handleEstadoFilterChange = (event) => {
    const value = event.target.value;
    setEstadoFiltro(value);
    setPage(0);
  };

  const handleMotivoFilterChange = (event) => {
    const value = event.target.value;
    setMotivoFiltro(value);
    setPage(0);
  };

  const handleColumnFilterChange = (field) => (event) => {
    const value = event.target.value;
    const updatedFilters = {
      ...columnFilters,
      [field]: value,
    };
    setColumnFilters(updatedFilters);
    setPage(0);
  };

  useEffect(() => {
    if (
      motivoFiltro !== "todos" &&
      !motivoOptions.some((option) => option.value === motivoFiltro)
    ) {
      setMotivoFiltro("todos");
      setPage(0);
    }
  }, [motivoOptions, motivoFiltro, fullClientesData, estadoFiltro, sortMethod, columnFilters, busquedaGeneral]);

  useEffect(() => {
    let changed = false;
    const nextFilters = { ...columnFilters };

    if (columnFilters.cuil !== "todos" && !columnOptions.cuil.includes(columnFilters.cuil)) {
      nextFilters.cuil = "todos";
      changed = true;
    }
    if (columnFilters.nombre !== "todos" && !columnOptions.nombre.includes(columnFilters.nombre)) {
      nextFilters.nombre = "todos";
      changed = true;
    }
    if (columnFilters.apellido !== "todos" && !columnOptions.apellido.includes(columnFilters.apellido)) {
      nextFilters.apellido = "todos";
      changed = true;
    }
    if (columnFilters.telefono !== "todos" && !columnOptions.telefono.includes(columnFilters.telefono)) {
      nextFilters.telefono = "todos";
      changed = true;
    }
    if (columnFilters.fecha !== "todos" && !columnOptions.fecha.includes(columnFilters.fecha)) {
      nextFilters.fecha = "todos";
      changed = true;
    }

    if (changed) {
      setColumnFilters(nextFilters);
      setPage(0);
    }
  }, [columnOptions, columnFilters, fullClientesData, motivoFiltro, estadoFiltro, sortMethod, busquedaGeneral]);

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
        <div className="search__container">
          <input
            type="text"
            className="search__input"
            placeholder="Buscar por CUIL, tel\u00E9fono, nombre, email..."
            value={busquedaGeneral}
            onChange={handleBusquedaChange}
          />
          {busquedaGeneral && (
            <button className="search__clear" type="button" onClick={handleClearBusqueda}>
              Limpiar
            </button>
          )}
        </div>
        <div className="table__container">
          <div
            className="table__page-size-control"
            style={{
              marginBottom: "1rem",
              alignSelf: "flex-start",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <label className="table__page-size-label" htmlFor="page-size-select">
              Elementos por página
            </label>
            <select
              id="page-size-select"
              className="table__page-size-select"
              value={String(pageSize)}
              onChange={handlePageSizeChange}
            >
              {[10, 20, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <h6>Clickea en cada encabezado para ordenarlo por ese valor</h6>
          <table>
            <thead>
              <tr>
                <th onClick={sortByIdAscend}>
                  <div className="table__header-cell">
                    <span>ID</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.cuil}
                      onChange={handleColumnFilterChange("cuil")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.cuil.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByNombreAscend}>
                  <div className="table__header-cell">
                    <span>Nombre</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.nombre}
                      onChange={handleColumnFilterChange("nombre")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.nombre.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByApellidoAscend}>
                  <div className="table__header-cell">
                    <span>Apellido</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.apellido}
                      onChange={handleColumnFilterChange("apellido")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.apellido.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByTelefonoAscend}>
                  <div className="table__header-cell">
                    <span>Telefono</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.telefono}
                      onChange={handleColumnFilterChange("telefono")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todos</option>
                      {columnOptions.telefono.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th onClick={sortByFechaSolicitudDescend}>
                  <div className="table__header-cell">
                    <span>Fecha Solicitud</span>
                    <select
                      className="table__header-filter"
                      value={columnFilters.fecha}
                      onChange={handleColumnFilterChange("fecha")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="todos">Todas</option>
                      {columnOptions.fecha.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>
                  <div className="table__header-cell">
                    <span>Solicitud aceptada</span>
                    <select
                      className="table__header-filter"
                      value={estadoFiltro}
                      onChange={handleEstadoFilterChange}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {estadoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>
                  <div className="table__header-cell">
                    <span>Motivo de rechazo</span>
                    <select
                      className="table__header-filter"
                      value={motivoFiltro}
                      onChange={handleMotivoFilterChange}
                      onClick={(event) => event.stopPropagation()}
                      disabled={motivoOptions.length === 0}
                    >
                      <option value="todos">Todos</option>
                      {motivoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>Borrar entrada</th>
              </tr>
            </thead>
            <tbody>
              {paginatedrecords.map((cliente, index) => {
                const resultadoDescripcion =
                  cliente.resultadoEvaluacionDescripcion ||
                  (cliente.estado === "aceptada"
                    ? "Procesamiento satisfactorio"
                    : cliente.motivoRechazo || "Motivo no informado");
                const mostrarDetalle =
                  cliente.estado === "rechazada" &&
                  cliente.motivoRechazo &&
                  cliente.motivoRechazo !== resultadoDescripcion;
                const fechaFormateada = getDay(cliente.timestamp) || "-";
                const telefonoVisible = cliente.telefono || "-";
                const estadoVisible =
                  cliente.estado === "aceptada"
                    ? "Si"
                    : cliente.estado === "rechazada"
                    ? "No"
                    : "Pendiente";
                return (
                  <tr key={cliente.id || index}>
                    <td>{cliente.cuil || "-"}</td>
                    <td>{cliente.nombre || "-"}</td>
                    <td>{cliente.apellido || "-"}</td>
                    <td>{telefonoVisible}</td>
                    <td>{fechaFormateada}</td>
                    <td>{estadoVisible}</td>
                    <td>
                      <span>{resultadoDescripcion}</span>
                      {mostrarDetalle && (
                        <span className="table__motivo-detalle">
                          {cliente.motivoRechazo}
                        </span>
                      )}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(cliente.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}






            </tbody>
          </table>
          <div className="pagination-container">
            <button
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              Pagina {page + 1} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => goToPage(page + 1)}
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


