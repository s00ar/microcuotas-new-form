/**
 * Migración ETL entre proyectos Firebase:
 * - Origen: Formulario Microcuotas (colección clientes)
 * - Destino: Microcuotas-Dev (colección clientes)
 * No copia subcolecciones ni campos auxiliares; normaliza al modelo cerrado.
 */
const admin = require('firebase-admin');

// Inicialización dual de Firebase Admin usando credenciales locales.
const sourceApp = admin.initializeApp(
  {
    credential: admin.credential.cert(require('./formulario-key.json')),
  },
  'formulario-microcuotas',
);

const targetApp = admin.initializeApp(
  {
    credential: admin.credential.cert(require('./dev-key.json')),
  },
  'microcuotas-dev',
);

const sourceDb = sourceApp.firestore();
const targetDb = targetApp.firestore();

/**
 * Normaliza un documento arbitrario al modelo cerrado de Microcuotas-Dev.
 * No deja campos undefined; aplica defaults estrictos y mapeo pedido.
 */
function normalizeCliente(raw = {}) {
  const hasBcra = Object.prototype.hasOwnProperty.call(raw, 'bcra');

  return {
    // Identidad
    nombreCompleto: raw.nombreCompleto ?? raw.nombre ?? raw.denominacion ?? '',
    nombre: raw.nombre ?? '',
    apellido: raw.apellido ?? '',

    // Identificación
    cuil: raw.cuil ?? raw.identificacion ?? '',
    telefono: raw.telefono ?? '',

    // Crédito
    monto: raw.monto ? Number(raw.monto) : null,
    cuotas: raw.cuotas ? Number(raw.cuotas) : null,
    ingresoMensual: raw.ingresoMensual ? Number(raw.ingresoMensual) : null,

    // Fechas
    fechaIngreso: raw.fechaIngreso ?? '',
    fechaSolicitud: raw.fechaSolicitud ?? '',

    // Información BCRA (opcional)
    bcra: hasBcra && raw.bcra !== undefined ? raw.bcra : null,

    // Sistema
    timestamp: admin.firestore.Timestamp.now(),
    origenMigracion: 'Formulario Microcuotas',
    versionModelo: 'Microcuotas-Dev-v1',
  };
}

/**
 * Lee todos los clientes del origen, normaliza y escribe en destino manteniendo el mismo doc.id.
 */
async function migrateClientes() {
  try {
    const snapshot = await sourceDb.collection('clientes').get();
    console.log(`Documentos encontrados en origen: ${snapshot.size}`);

    let processed = 0;
    for (const docSnap of snapshot.docs) {
      const raw = docSnap.data();

      try {
        const normalized = normalizeCliente(raw);
        await targetDb.collection('clientes').doc(docSnap.id).set(normalized);
        processed += 1;
        console.log(`[${processed}/${snapshot.size}] Migrado: ${docSnap.id}`);
      } catch (docErr) {
        console.error(`Error migrando doc ${docSnap.id}:`, docErr);
      }
    }

    console.log('Migración finalizada correctamente.');
  } catch (err) {
    console.error('Error general en la migración:', err);
    process.exit(1);
  } finally {
    // Cierra conexiones de ambos proyectos.
    await Promise.allSettled([sourceApp.delete(), targetApp.delete()]);
  }
}

migrateClientes();
