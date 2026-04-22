import { initializeApp } from "firebase/app";
// import { getDatabase } from "firebase/database";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
} from "firebase/auth";
import {
  query,
  getDocs,
  where,
  initializeFirestore,
  collection,
  addDoc,
  deleteDoc,
  orderBy,
  doc,
  getDoc,
  setDoc,
  limit as firestoreLimit,
  writeBatch,
  startAfter,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyA34nXpHgcCSrD6ztqLW9dCtsXTj5wo3ww",
  authDomain: "microcuotas-dev.firebaseapp.com",
  projectId: "microcuotas-dev",
  storageBucket: "microcuotas-dev.firebasestorage.app",
  messagingSenderId: "591172272146",
  appId: "1:591172272146:web:c2587b31ecaf0a833618cb",
  measurementId: "G-CYV2NJKQ7P",
};

const resolveFirebaseConfig = () => {
  const overrides = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
  };

  const sanitizedOverrides = Object.entries(overrides).reduce((acc, [key, value]) => {
    if (typeof value === "string" && value.trim().length > 0) {
      acc[key] = value.trim();
    }
    return acc;
  }, {});

  const mergedConfig = { ...defaultFirebaseConfig, ...sanitizedOverrides };

  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
  const missingKeys = requiredKeys.filter((key) => !mergedConfig[key]);
  if (missingKeys.length) {
    console.warn(
      `Firebase config missing keys: ${missingKeys.join(
        ", "
      )}. Check your .env (REACT_APP_FIREBASE_* variables).`
    );
  }

  return mergedConfig;
};

const firebaseConfig = resolveFirebaseConfig();

const app = initializeApp(firebaseConfig);
// const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);
const db = initializeFirestore(app, {
  // Ayuda en redes/proxies donde el stream WebChannel falla (errores Listen/channel).
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});


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
  role
  });
} catch (err) {
  console.error(err);
  alert(err.message);
}
};

const isAdmin = async (uid) => {
  const q = query(collection(db, "users"), where("uid", "==", uid));
  const doc = await getDocs(q);
  if (doc.docs.length > 0) {
      const data = doc.docs[0].data();
      return data.role === "admin";
  } else {
    return false; // o cualquier otro valor por defecto
  }
};

const isReport = async (uid) => {
  const q = query(collection(db, "users"), where("uid", "==", uid));
  const doc = await getDocs(q);
  if (doc.docs.length > 0) {
      const data = doc.docs[0].data();
      return data.role === "report";
  } else {
    return false; // o cualquier otro valor por defecto
  }
};  

const fetchContactsData = async (startDate, endDate, extraOptions = {}) => {
  // Backwards compatible signature: fetchContactsData(startDate, endDate)
  // New signature: fetchContactsData({ startDate, endDate, limit, startAfter, withCursor })
  const resolvedOptions =
    typeof startDate === "object" && startDate !== null && !Array.isArray(startDate)
      ? { ...startDate }
      : { startDate, endDate, ...extraOptions };

  const {
    startDate: start,
    endDate: end,
    limit: limitSize,
    startAfter: startAfterDoc,
    withCursor = false,
  } = resolvedOptions;

  const constraints = [orderBy("timestamp", "desc")];

  if (start && !end) {
    constraints.push(where("timestamp", ">=", new Date(start)));
  } else if (!start && end) {
    constraints.push(where("timestamp", "<=", new Date(end)));
  } else if (start && end) {
    constraints.push(where("timestamp", ">=", new Date(start)));
    constraints.push(where("timestamp", "<=", new Date(end)));
  }

  if (limitSize) {
    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }
    constraints.push(firestoreLimit(limitSize));
  }

  const q = query(collection(db, "clientes"), ...constraints);

  const querySnapshot = await getDocs(q);
  const data = querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  if (withCursor) {
    const lastDoc = querySnapshot.docs.length
      ? querySnapshot.docs[querySnapshot.docs.length - 1]
      : null;
    return { rows: data, lastDoc };
  }

  return data;
};

const deleteOldClientesBefore = async (cutoffDate, { batchSize = 500 } = {}) => {
  if (!cutoffDate) {
    return { deleted: 0, hasMore: false };
  }

  const cutoff = cutoffDate instanceof Date ? cutoffDate : new Date(cutoffDate);
  if (Number.isNaN(cutoff.getTime())) {
    return { deleted: 0, hasMore: false };
  }

  const constraints = [
    orderBy("timestamp", "asc"),
    where("timestamp", "<", cutoff),
    firestoreLimit(batchSize),
  ];

  const q = query(collection(db, "clientes"), ...constraints);
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return { deleted: 0, hasMore: false };
  }

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(doc(db, "clientes", docSnap.id));
  });
  await batch.commit();

  const deleted = snapshot.size;
  const hasMore = deleted >= batchSize;
  return { deleted, hasMore };
};

const SIMULATION_PARAMS_PATH = ["config", "simulationParams"];

const getSimulationParams = async () => {
  const docRef = doc(db, ...SIMULATION_PARAMS_PATH);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return {
      minCuotas: 2,
      maxCuotas: 12,
      minMonto: 50000,
      maxMonto: 500000,
      interesesPorCuota: {}
    };
  }

  return snap.data();
};

const updateSimulationParams = async (params) => {
  const docRef = doc(db, ...SIMULATION_PARAMS_PATH);
  await setDoc(docRef, params, { merge: true });
};

const logout = () => {
signOut(auth);
};

export {
  auth,
  db,
  storage,
  deleteDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  logInWithEmailAndPassword,
  registerWithEmailAndPassword,
  sendPasswordResetEmail,
  logout,
  isAdmin,
  isReport,
  fetchContactsData,
  deleteOldClientesBefore,
  getSimulationParams,
  updateSimulationParams
};
export default firebaseConfig;

