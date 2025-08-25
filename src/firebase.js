// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  signInAnonymously,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";

// ———————————————————————————————————————————
// Config & init
// ———————————————————————————————————————————
const firebaseConfig = {
  apiKey: "AIzaSyABW1gZYGY8u9OdqStvscD55w9ReZc2PnY",
  authDomain: "formulario-reactjs-f7217.firebaseapp.com",
  databaseURL: "https://formulario-reactjs-f7217-default-rtdb.firebaseio.com",
  projectId: "formulario-reactjs-f7217",
  storageBucket: "formulario-reactjs-f7217.appspot.com",
  messagingSenderId: "382828826062",
  appId: "1:382828826062:web:057a9e1ad89d9a0e94ef9f",
  measurementId: "G-8VMVW5NTZB",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// ———————————————————————————————————————————
// Auth util: sesión anónima para habilitar lecturas/regs
// ———————————————————————————————————————————
export async function ensureAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}

// ———————————————————————————————————————————
/** Parámetros de simulación (config/simulationParams) */
// ———————————————————————————————————————————
const SIM_DOC = "simulationParams";

/** Lee una sola vez los parámetros de simulación */
export async function getSimulationParams() {
  await ensureAuth();
  const refDoc = doc(db, "config", SIM_DOC);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) throw new Error("No existe config/simulationParams");
  const d = snap.data();
  return {
    minCuotas: d.minCuotas,
    maxCuotas: d.maxCuotas,
    minMonto: d.minMonto,
    maxMonto: d.maxMonto,
    interesesPorCuota: d.interesesPorCuota || {},
  };
}

/**
 * Suscribe a cambios de config/simulationParams.
 * Garantiza auth antes de abrir el snapshot.
 * Devuelve un `unsubscribe()` válido inmediatamente (no-op hasta conectar).
 */
export function subscribeToSimulationParams(cb, onError) {
  let unsubscribe = () => {};
  (async () => {
    try {
      await ensureAuth();
      const refDoc = doc(db, "config", SIM_DOC);
      const _unsub = onSnapshot(
        refDoc,
        (snap) => {
          if (!snap.exists()) {
            onError?.(new Error("missing doc"));
            return;
          }
          const d = snap.data();
          cb({
            minCuotas: d.minCuotas,
            maxCuotas: d.maxCuotas,
            minMonto: d.minMonto,
            maxMonto: d.maxMonto,
            interesesPorCuota: d.interesesPorCuota || {},
          });
        },
        (err) => onError?.(err)
      );
      unsubscribe = _unsub;
    } catch (e) {
      onError?.(e);
    }
  })();
  return () => unsubscribe();
}

/** Actualiza toda la config (incluye el map interesesPorCuota) */
export async function updateSimulationParams(params) {
  await ensureAuth();
  const refDoc = doc(db, "config", SIM_DOC);
  await updateDoc(refDoc, {
    minCuotas: params.minCuotas,
    maxCuotas: params.maxCuotas,
    minMonto: params.minMonto,
    maxMonto: params.maxMonto,
    interesesPorCuota: params.interesesPorCuota,
    updatedAt: serverTimestamp(),
  });
}

// ———————————————————————————————————————————
// Helpers de autenticación y usuarios
// ———————————————————————————————————————————
const logInWithEmailAndPassword = async (email, password) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

const registerWithEmailAndPassword = async (name, email, password, role) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const user = res.user;
    await addDoc(collection(db, "users"), {
      uid: user.uid,
      name,
      authProvider: "local",
      email,
      role,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

const isAdmin = async (uid) => {
  await ensureAuth();
  const q = query(collection(db, "users"), where("uid", "==", uid));
  const d = await getDocs(q);
  if (d.docs.length > 0) {
    const data = d.docs[0].data();
    return data.role === "admin";
  }
  return false;
};

const isReport = async (uid) => {
  await ensureAuth();
  const q = query(collection(db, "users"), where("uid", "==", uid));
  const d = await getDocs(q);
  if (d.docs.length > 0) {
    const data = d.docs[0].data();
    return data.role === "report";
  }
  return false;
};

// ———————————————————————————————————————————
// Datos: clientes (para panel/reportes)
// ———————————————————————————————————————————
const fetchContactsData = async (startDate, endDate) => {
  await ensureAuth();
  let qRef = collection(db, "clientes");

  if (startDate && !endDate) {
    qRef = query(qRef, orderBy("timestamp", "desc"), where("timestamp", ">=", new Date(startDate)));
  } else if (!startDate && endDate) {
    qRef = query(qRef, orderBy("timestamp", "desc"), where("timestamp", "<=", new Date(endDate)));
  } else if (startDate && endDate) {
    qRef = query(
      qRef,
      orderBy("timestamp", "desc"),
      where("timestamp", ">", new Date(startDate)),
      where("timestamp", "<", new Date(endDate))
    );
  } else {
    qRef = query(qRef, orderBy("timestamp", "desc"));
  }

  const snap = await getDocs(qRef);
  const data = [];
  snap.forEach((d) => data.push(d.data()));
  return data;
};

const logout = () => signOut(auth);

// ———————————————————————————————————————————
// Exports
// ———————————————————————————————————————————
export {
  auth,
  db,
  storage,
  analytics,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteDoc,
  logInWithEmailAndPassword,
  registerWithEmailAndPassword,
  sendPasswordResetEmail,
  logout,
  isAdmin,
  isReport,
  fetchContactsData,
};

export default firebaseConfig;
