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
    orderBy
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAb00iozgNSQhwWlV0dbOtDCnmqyvtmoa0",
  authDomain: "microcuotas-e86ba.firebaseapp.com",
  projectId: "microcuotas-e86ba",
  storageBucket: "microcuotas-e86ba.appspot.com",
  messagingSenderId: "52247316363",
  appId: "1:52247316363:web:a63f793eae2e3b5db2118e",
};

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

