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
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  orderBy,
  doc,
  getDoc,
  setDoc
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
const db = getFirestore(app);


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

const fetchContactsData = async (startDate, endDate) => {
  let q = collection(db, "clientes");
  
  if (startDate && !endDate) {
    q = query(q, orderBy('timestamp', 'desc'), where('timestamp', '>=', new Date(startDate)));
  } else if (!startDate && endDate) {
    q = query(q, orderBy('timestamp', 'desc'), where('timestamp', '<=', new Date(endDate)));
  } else if (startDate && endDate) {
    q = query(q, orderBy('timestamp', 'desc'), 
      where('timestamp', '>', new Date(startDate)),
      where('timestamp', '<', new Date(endDate))
    );
  } else {
    q = query(q, orderBy('timestamp', 'desc'));
  }

  const querySnapshot = await getDocs(q);
  let data = [];
  querySnapshot.forEach((docSnap) => {
    data.push({ id: docSnap.id, ...docSnap.data() });
  });
  // console.log({ data });
  return data;
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
  getSimulationParams,
  updateSimulationParams
};
export default firebaseConfig;

