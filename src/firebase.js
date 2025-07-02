import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
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
  onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyABW1gZYGY8u9OdqStvscD55w9ReZc2PnY",
  authDomain: "formulario-reactjs-f7217.firebaseapp.com",
  databaseURL: "https://formulario-reactjs-f7217-default-rtdb.firebaseio.com",
  projectId: "formulario-reactjs-f7217",
  storageBucket: "formulario-reactjs-f7217.appspot.com",
  messagingSenderId: "382828826062",
  appId: "1:382828826062:web:057a9e1ad89d9a0e94ef9f",
  measurementId: "G-8VMVW5NTZB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);


// ID fijo del documento en Firestore donde guardamos los parámetros
const SIM_DOC = "simulationParams";


// retrieves simulation parameters from firebase firestore from the config collection


/**
 * Lee una única vez los parámetros de simulación desde config/SIM_DOC.
 */
export async function getSimulationParams() {
  const refDoc = doc(db, "config", SIM_DOC);
  const snap   = await getDoc(refDoc);
  if (!snap.exists()) throw new Error("No existe config/simulationParams");

  const data = snap.data();
  return {
    minCuotas:         data.minCuotas,
    maxCuotas:         data.maxCuotas,
    minMonto:          data.minMonto,
    maxMonto:          data.maxMonto,
    interesesPorCuota: data.interesesPorCuota || {},  // <— aquí
  };
}

/**
 * Se suscribe y entrega TODO el objeto (map incluido)
 */
export function subscribeToSimulationParams(cb, onError) {
  const refDoc = doc(db, "config", SIM_DOC);
  return onSnapshot(
    refDoc,
    snap => {
      if (!snap.exists()) return onError?.(new Error("missing doc"));
      const data = snap.data();
      cb({
        minCuotas:         data.minCuotas,
        maxCuotas:         data.maxCuotas,
        minMonto:          data.minMonto,
        maxMonto:          data.maxMonto,
        interesesPorCuota: data.interesesPorCuota || {},
      });
    },
    onError
  );
}

/**
 * Guarda TODO, map incluido
 */
export async function updateSimulationParams(params) {
  const refDoc = doc(db, "config", SIM_DOC);
  await updateDoc(refDoc, {
    minCuotas:         params.minCuotas,
    maxCuotas:         params.maxCuotas,
    minMonto:          params.minMonto,
    maxMonto:          params.maxMonto,
    interesesPorCuota: params.interesesPorCuota,
  });
}

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
  querySnapshot.forEach((doc) => {
    data.push(doc.data());
  });
  // console.log({ data });
  return data;
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
  fetchContactsData
};
export default firebaseConfig;