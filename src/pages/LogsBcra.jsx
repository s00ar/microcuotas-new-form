import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { getApp } from "firebase/app";
import { auth, db } from "../firebase";
import "../css/LogsBcra.css";
import Banner from "../components/Header-Loged";

const hashCuil = async (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) {
    return null;
  }
  if (typeof crypto === "undefined" || !crypto?.subtle) {
    return null;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(digits);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const formatLogTimestamp = (value) => {
  if (!value) {
    return "-";
  }
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString("es-AR");
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleString("es-AR");
  }
  return "-";
};

const PAGE_SIZES = [20, 50, 100];

export default function LogsBcra() {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const [logMode, setLogMode] = useState("recent");
  const [logFilter, setLogFilter] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursorStack, setCursorStack] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const projectId = useMemo(() => {
    try {
      return getApp().options?.projectId || "";
    } catch (err) {
      return "";
    }
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  const resolvedFilterPlaceholder = useMemo(
    () => (logMode === "requestId" ? "RequestId" : "CUIL"),
    [logMode]
  );

  const resetPagination = useCallback(() => {
    setPageIndex(0);
    setCursorStack([]);
  }, []);

  const fetchLogs = useCallback(
    async (targetPage = 0, { reset = false } = {}) => {
      setLogLoading(true);
      setLogError("");

      try {
        let constraints = [orderBy("createdAt", "desc"), limit(pageSize)];

        if (logMode === "requestId") {
          const requestId = String(logFilter || "").trim();
          if (!requestId) {
            setLogError("Ingresá un requestId para buscar.");
            setLogLoading(false);
            return;
          }
          constraints = [
            where("requestId", "==", requestId),
            orderBy("createdAt", "desc"),
            limit(pageSize),
          ];
        } else if (logMode === "cuil") {
          const cuilHash = await hashCuil(logFilter);
          if (!cuilHash) {
            setLogError("Ingresá un CUIL válido de 11 dígitos.");
            setLogLoading(false);
            return;
          }
          constraints = [
            where("cuilHash", "==", cuilHash),
            orderBy("createdAt", "desc"),
            limit(pageSize),
          ];
        }

        if (targetPage > 0) {
          const cursor = cursorStack[targetPage - 1];
          if (!cursor) {
            setLogError("No hay más páginas disponibles.");
            setLogLoading(false);
            return;
          }
          constraints = [...constraints, startAfter(cursor)];
        }

        const logsQuery = query(collection(db, "bcraProxyLogs"), ...constraints);
        const snapshot = await getDocs(logsQuery);
        const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

        setLogEntries(rows);
        setHasNext(rows.length === pageSize);
        setPageIndex(targetPage);

        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        if (lastDoc) {
          setCursorStack((prev) => {
            const nextStack = reset ? [] : [...prev];
            nextStack[targetPage] = lastDoc;
            return nextStack;
          });
        }
      } catch (error) {
        console.error("Error cargando logs BCRA:", error);
        setLogError("No pudimos cargar los logs del BCRA.");
      } finally {
        setLogLoading(false);
      }
    },
    [logMode, logFilter, pageSize, cursorStack]
  );

  useEffect(() => {
    resetPagination();
    setLogEntries([]);
    setHasNext(false);
    setLogError("");
  }, [logMode, pageSize, resetPagination]);

  const handleSearch = () => {
    resetPagination();
    fetchLogs(0, { reset: true });
  };

  const handleClear = () => {
    setLogFilter("");
    setLogMode("recent");
    resetPagination();
    fetchLogs(0, { reset: true });
  };

  const handlePrev = () => {
    if (pageIndex <= 0) {
      return;
    }
    fetchLogs(pageIndex - 1);
  };

  const handleNext = () => {
    if (!hasNext) {
      return;
    }
    fetchLogs(pageIndex + 1);
  };

  useEffect(() => {
    if (logMode === "recent" && user) {
      fetchLogs(0, { reset: true });
    }
  }, [logMode, user, fetchLogs]);

  return (
    <div>
      <Banner />
      <div className="logs-background">
        <div className="logs-container">
          <div className="logs-header">
            <h2>Logs BCRA</h2>
            <div className="logs-controls">
              <select
                className="logs-select"
                value={logMode}
                onChange={(event) => setLogMode(event.target.value)}
              >
                <option value="recent">Últimos registros</option>
                <option value="cuil">Por CUIL</option>
                <option value="requestId">Por requestId</option>
              </select>
              <input
                className="logs-input"
                type="text"
                placeholder={resolvedFilterPlaceholder}
                value={logFilter}
                onChange={(event) => setLogFilter(event.target.value)}
                disabled={logMode === "recent"}
              />
              <select
                className="logs-select"
                value={String(pageSize)}
                onChange={(event) => setPageSize(Number(event.target.value))}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} por página
                  </option>
                ))}
              </select>
              <button className="logs-btn" type="button" onClick={handleSearch} disabled={logLoading}>
                {logLoading ? "Cargando..." : "Buscar"}
              </button>
              <button className="logs-btn logs-btn--ghost" type="button" onClick={handleClear}>
                Limpiar
              </button>
            </div>
          <div className="logs-hint">
            Si buscás por CUIL se usa hash SHA-256; el CUIL completo no se guarda en logs.
          </div>
          {projectId && (
            <div className="logs-hint">Proyecto Firebase activo: {projectId}</div>
          )}
            {logError && <div className="logs-error">{logError}</div>}
          </div>

          <div className="logs-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>RequestId</th>
                  <th>CUIL</th>
                  <th>Histórico</th>
                  <th>Status</th>
                  <th>Intento</th>
                  <th>ms</th>
                  <th>Cache</th>
                  <th>Error</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.length === 0 && !logLoading && (
                  <tr>
                    <td colSpan={10}>Sin registros.</td>
                  </tr>
                )}
                {logEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatLogTimestamp(entry.createdAt)}</td>
                    <td>{entry.requestId || "-"}</td>
                    <td>{entry.cuilMasked || "-"}</td>
                    <td>{entry.historico ? "Si" : "No"}</td>
                    <td>{entry.status ?? "-"}</td>
                    <td>{entry.attempt ?? "-"}</td>
                    <td>{entry.elapsedMs ?? "-"}</td>
                    <td>{entry.cacheUsed ? "Si" : "No"}</td>
                    <td>{entry.errorType || "-"}</td>
                    <td className="logs-payload">{entry.payloadSnippet || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="logs-pagination">
            <button onClick={handlePrev} disabled={pageIndex === 0 || logLoading}>
              Anterior
            </button>
            <span>Página {pageIndex + 1}</span>
            <button onClick={handleNext} disabled={!hasNext || logLoading}>
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
