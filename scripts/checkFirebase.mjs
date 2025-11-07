global.alert = (...args) => console.log("[alert]", ...args);

import firebaseConfig, { fetchContactsData } from "../src/firebase.js";
import { getApps, deleteApp } from "firebase/app";

const prettyError = (error) => {
  if (!error) {
    return "Unknown error";
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const main = async () => {
  console.log("⏳ Iniciando prueba de acceso a Firebase...");
  try {
    const rows = await fetchContactsData();
    if (Array.isArray(rows)) {
      console.log(`✅ fetchContactsData respondió ${rows.length} registros.`);
    } else {
      console.log("⚠️ fetchContactsData respondió un valor no esperado:", rows);
    }
    console.log("✅ Acceso a Firestore completado sin excepciones.");
  } catch (error) {
    console.error("❌ No se pudo acceder a Firestore:", prettyError(error));
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    const apps = getApps();
    await Promise.all(
      apps.map((app) =>
        deleteApp(app).catch((error) =>
          console.warn(`No se pudo cerrar la app ${app.name}:`, prettyError(error))
        )
      )
    );
  }
};

main();
