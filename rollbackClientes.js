/**
 * Rollback seguro de documentos migrados en Microcuotas-Dev/clientes.
 * Elimina solo los creados por la migración previa (origenMigracion === "Formulario Microcuotas").
 */
const admin = require('firebase-admin');

// Inicializa solo el proyecto de destino (Microcuotas-Dev) con la credencial local.
admin.initializeApp({
  credential: admin.credential.cert(require('./dev-key.json')),
});

const db = admin.firestore();

/**
 * Ejecuta el rollback de clientes migrados.
 * Idempotente: si no hay documentos coincidentes, no realiza cambios.
 */
async function rollbackClientes() {
  try {
    const snapshot = await db
      .collection('clientes')
      .where('origenMigracion', '==', 'Formulario Microcuotas')
      .get();

    console.log(`Documentos migrados encontrados: ${snapshot.size}`);
    if (snapshot.empty) {
      console.log('No hay documentos para eliminar.');
      return;
    }

    let processed = 0;
    for (const docSnap of snapshot.docs) {
      const docId = docSnap.id;
      try {
        console.log(`Eliminando ${docId}...`);
        await db.collection('clientes').doc(docId).delete();
        processed += 1;
      } catch (docErr) {
        console.error(`Error eliminando ${docId}:`, docErr);
      }
    }

    console.log(`Rollback finalizado. Eliminados: ${processed}/${snapshot.size}`);
  } catch (err) {
    console.error('Error general en rollback:', err);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

rollbackClientes();
