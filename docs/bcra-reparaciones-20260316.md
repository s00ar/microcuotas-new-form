# BCRA y reglas de negocio - Reparaciones y logging (2026-03-16)

## Resumen
Se reforzo la consulta a BCRA con timeout, reintentos y logging estructurado, y se agrego validacion defensiva de edad antes de aprobar solicitudes.

## Cambios realizados
1. BCRA - request robusto con logs y retry
   - Archivo: D:\Documents\dev\PIXVO.TECH\microcuotas\formulario.microcuotas.com.ar\v4.0.6\src\pages\Paso4.jsx
   - Se agregaron:
     - Timeout explicito (12s) con AbortController.
     - Reintentos con backoff para errores de red, timeouts y 5xx/429.
     - Logging estructurado de status, content-type, payload truncado y tiempo de respuesta.
     - Deteccion de payload no JSON (por ejemplo HTML/XML) como error explicito.

2. Validacion de edad defensiva al aprobar
   - Archivo: D:\Documents\dev\PIXVO.TECH\microcuotas\formulario.microcuotas.com.ar\v4.0.6\src\pages\Paso5.jsx
   - Se agrego validacion de edad (>= 30 anos) antes de enviar la solicitud aprobada.
   - Esto evita que un usuario que llegue a Paso5 sin pasar por Paso2 quede aprobado si es menor.

## Logica de logs agregada
- Se agrego un helper logBcraEvent para emitir logs en consola con contexto:
  - status HTTP, content-type, payloadSnippet, elapsedMs, intento.
- En caso de error, el mensaje es "BCRA request failed" o "Paso4 BCRA fetch error".
- En caso de exito, el mensaje es "BCRA response ok".

## Razonamiento de las correcciones
- Si la API responde con HTML/XML (mantenimiento, WAF, CORS, proxy), antes se parseaba como string y el flujo terminaba en error generico. Ahora se detecta como payload no JSON y se reporta con detalle en logs.
- Sin timeout, un request puede quedar colgado. Ahora se aborta en 12s y reintenta.
- Errores temporales (429/5xx, red intermitente) ahora reintentan en lugar de fallar al primer intento.
- La edad se validaba solo en UI (Paso2), pero no en la etapa final. Ahora se valida tambien en Paso5.

## Archivos modificados
- D:\Documents\dev\PIXVO.TECH\microcuotas\formulario.microcuotas.com.ar\v4.0.6\src\pages\Paso4.jsx
- D:\Documents\dev\PIXVO.TECH\microcuotas\formulario.microcuotas.com.ar\v4.0.6\src\pages\Paso5.jsx

## Sugerencias de verificacion
- Probar un CUIL valido y verificar en consola logs de "BCRA response ok".
- Forzar error (por ejemplo desconectar red) y ver logs con status/payloadSnippet y reintentos.
- Probar fecha de nacimiento con 29 anos en Paso5 y confirmar rechazo.
3. BCRA - proxy en Firebase Functions
   - Archivo: D:\\Documents\\dev\\PIXVO.TECH\\microcuotas\\formulario.microcuotas.com.ar\\v4.0.6\\functions\\index.js
   - Endpoint: `/api/bcra?cuil=...&historico=0|1`
   - Resuelve CORS y errores de conexion desde el navegador.
