# Microcuotas – Guía de Funcionalidades y Cambios Recientes

## Panorama General
- Flujo de solicitud de crédito escalonado en pasos (`Paso1` → `Paso5`) con validaciones de CUIL, teléfono y correo.
- Formularios administrativos (`ClientForm`) y panel de reportes (`Report`) conectados a Firestore para gestionar clientes, filtrarlos y exportar los datos.
- Integración con servicios auxiliares (`services/solicitudes.js`) para normalizar campos, validar unicidad y registrar aprobaciones o rechazos.
- Dashboard para usuarios autenticados con métricas y gráficos.

## Novedades Destacadas
- **Spinner global diferido**: `GlobalLoadingProvider` muestra un overlay cuando hay operaciones prolongadas, evitando parpadeos para cargas cortas y dando feedback consistente al usuario.
- **Sincronización automática del spinner** en los flujos críticos (`Report`, `Paso4`, `Paso5`, `ClientForm`, `Login`) para que cualquier llamada a Firestore u operaciones de guardado reflejen su estado de carga.
- **Reportes refinados**:
  - Selector dinámico de tamaño de página (10/20/50/100/200) y reseteo automático de la paginación.
  - Layout con márgenes, tarjeta central y sombra sutil para mejorar la legibilidad del dashboard.
- **Unicidad de campos con contexto**: los envíos aceptados pueden reusar teléfono y correo cuando pertenecen al mismo CUIL, evitando rechazos innecesarios.

## Pruebas
- **Unitarias** (`src/components/__tests__/GlobalLoadingProvider.test.jsx`): validan el retardo del spinner y su limpieza al concluir las operaciones.
- **Integración** (`src/pages/__tests__/Report.test.jsx`): cubren la carga de datos, la interacción con el selector de página y la visibilidad del spinner durante las consultas iniciales.

Para ejecutar la suite:

```bash
npm test -- --watch=false
```

## Próximos Pasos Sugeridos
- Documentar escenarios de error específicos y mensajes mostrados al usuario.
- Incorporar pruebas end-to-end para el flujo de solicitud completo (por ejemplo, con Playwright o Cypress).
- Automatizar despliegues y validaciones en CI aprovechando las nuevas pruebas unitarias.
