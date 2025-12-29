/**
 * Rollback de documentos migrados en Microcuotas-Dev/clientes.
 * Elimina solo los que tienen origenMigracion === "Formulario Microcuotas"
 * y versionModelo === "Microcuotas-Dev-v1".
 */
const admin = require('firebase-admin');
const serviceAccount = require('./dev-key.json');

// Inicializa unicamente el proyecto Microcuotas-Dev con la credencial local.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Ejecuta el rollback de clientes migrados.
 * Idempotente: si no hay documentos coincidentes, no realiza cambios.
 */
async function rollbackClientes() {
  console.log('Iniciando rollback de clientes migrados...');
  try {
    const snapshot = await db
      .collection('clientes')
      .where('origenMigracion', '==', 'Formulario Microcuotas')
      .where('versionModelo', '==', 'Microcuotas-Dev-v1')
      .get();

    const total = snapshot.size;
    console.log(`Documentos migrados encontrados: ${total}`);
    if (snapshot.empty) {
      console.log('No hay documentos para eliminar.');
      return;
    }

    const ids = snapshot.docs.map((doc) => doc.id);
    console.log('IDs a eliminar:', ids.join(', '));

    let processed = 0;
    for (const docSnap of snapshot.docs) {
      const docRef = db.collection('clientes').doc(docSnap.id);
      try {
        await docRef.delete();
        processed += 1;
        console.log(`Eliminado: ${docSnap.id}`);
      } catch (docErr) {
        console.error(
          `Error eliminando ${docSnap.id}:`,
          docErr && docErr.message ? docErr.message : docErr
        );
      }
    }

    console.log(`Rollback finalizado. Eliminados: ${processed}/${total}`);
  } catch (err) {
    console.error(
      'Error general en rollback:',
      err && err.message ? err.message : err
    );
    process.exitCode = 1;
  } finally {
    try {
      await admin.app().delete();
    } catch (closeErr) {
      console.error(
        'Error cerrando la app:',
        closeErr && closeErr.message ? closeErr.message : closeErr
      );
    }
  }
}

rollbackClientes().catch((err) => {
  console.error('Fallo inesperado:', err && err.message ? err.message : err);
  process.exitCode = 1;
});
