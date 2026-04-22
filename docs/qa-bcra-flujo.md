# QA BCRA + Reglas de Edad

## Objetivo
Validar que el flujo no apruebe menores de 30 años y que los errores de BCRA se manejen de forma resiliente (timeouts, respuestas no-JSON, errores 5xx/429).

## Entorno
- Usar un navegador con DevTools.
- Usar CUIL real o de prueba.
- Si se usa proxy en Firebase Functions, el frontend consume `/api/bcra` en el mismo dominio.

## Pruebas Manuales
1. Caso OK (BCRA responde normal)
1. Ingresar CUIL válido y avanzar hasta Paso4.
1. Confirmar que aparece el nombre y permite continuar.

1. Timeout / red intermitente
1. Abrir DevTools > Network y activar "Offline".
1. Ir a Paso4.
1. Confirmar que aparece el error y el botón "Reintentar".
1. Desactivar "Offline" y reintentar.

1. Respuesta no JSON (HTML/XML)
1. Usar un proxy local o override de respuesta en DevTools.
1. Forzar que la respuesta sea `text/html` con un body HTML.
1. Confirmar que aparece el error "No pudimos obtener tu nombre desde BCRA" con detalle.

1. Errores 5xx / 429 (reintentos)
1. Mockear el endpoint para responder 500 o 429 en el primer intento y 200 en el segundo.
1. Verificar que el flujo recupera y muestra el nombre.

1. Timeout (AbortError)
1. Simular un timeout/AbortError en el primer request (proxy o mock).
1. Confirmar que el flujo reintenta y se recupera en el segundo intento.

## Nota para desarrollo local
- Para desarrollo local podés definir `REACT_APP_BCRA_PROXY_URL` apuntando al emulator o a un proxy local.

1. Edad mínima (defensiva)
1. Acceder directo a `/paso5` con `birthdate` de 29 años.
1. Completar teléfono y correo.
1. Confirmar que bloquea con "Debes ser mayor de 30 años".

## Evidencias
- Capturas de pantalla del error y del flujo OK.
- Log de consola con eventos `BCRA` en casos de error y reintento.

## Resultados esperados
- No se aprueban menores de 30 años.
- BCRA tolera fallas temporales y recupera cuando la API responde.
- Si la respuesta no es JSON, se muestra error con detalle y se registra en consola.
