import fs from "fs";
import path from "path";
import admin from "firebase-admin";

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply");
const daysArg = Array.from(args).find((arg) => arg.startsWith("--days="));
const windowArg = Array.from(args).find((arg) => arg.startsWith("--window-minutes="));
const days = daysArg ? Number(daysArg.split("=")[1]) : 30;
const windowMinutes = windowArg ? Number(windowArg.split("=")[1]) : 10;

if (!Number.isFinite(days) || days <= 0) {
  throw new Error("Invalid --days value");
}
if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) {
  throw new Error("Invalid --window-minutes value");
}

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT || "formulario-key.json";
const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  throw new Error(`Service account not found: ${resolvedPath}`);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const windowMs = windowMinutes * 60 * 1000;

const toDelete = [];
let scanned = 0;
let lastDoc = null;

const normalizeDayKey = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${year}-${month}-${day}`;
};

const processBatch = async () => {
  const query = db
    .collection("clientes")
    .orderBy("timestamp", "desc")
    .limit(500);

  const snapshot = lastDoc ? await query.startAfter(lastDoc).get() : await query.get();
  if (snapshot.empty) {
    return false;
  }

  const grouped = new Map();

  snapshot.docs.forEach((docSnap) => {
    scanned += 1;
    const data = docSnap.data();
    const estado = data?.estado;
    const timestamp = data?.timestamp?.toDate ? data.timestamp.toDate() : null;
    if (!timestamp || timestamp < cutoff) {
      return;
    }
    if (estado !== "rechazada") {
      return;
    }
    const cuil = String(data?.cuil || "");
    const motivo = String(data?.motivoRechazoCodigo || "sin_codigo");
    const dayKey = normalizeDayKey(timestamp);
    const key = `${cuil}|${motivo}|${dayKey}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push({ id: docSnap.id, timestamp });
  });

  grouped.forEach((items) => {
    items.sort((a, b) => a.timestamp - b.timestamp);
    let lastKept = null;
    items.forEach((item, index) => {
      if (index === 0) {
        lastKept = item.timestamp;
        return;
      }
      if (lastKept && item.timestamp - lastKept <= windowMs) {
        toDelete.push(item.id);
      } else {
        lastKept = item.timestamp;
      }
    });
  });

  lastDoc = snapshot.docs[snapshot.docs.length - 1];
  return true;
};

while (await processBatch()) {
  if (lastDoc && lastDoc.data()?.timestamp?.toDate && lastDoc.data().timestamp.toDate() < cutoff) {
    break;
  }
}

console.log(
  `Scanned: ${scanned}. Duplicates to delete: ${toDelete.length}. Dry-run: ${dryRun}`
);

if (!dryRun && toDelete.length) {
  let index = 0;
  while (index < toDelete.length) {
    const batch = db.batch();
    const chunk = toDelete.slice(index, index + 500);
    chunk.forEach((docId) => {
      const ref = db.collection("clientes").doc(docId);
      batch.delete(ref);
    });
    await batch.commit();
    index += chunk.length;
  }
  console.log("Deletion completed.");
}

