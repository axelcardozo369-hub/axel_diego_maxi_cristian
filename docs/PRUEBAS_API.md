# Fase 4 — Guía de pruebas y checklist

Supuestos: servidor en `http://localhost:3000` y datos cargados con `npm run seed`.
En Thunder Client o Postman: mismo método, URL, header `Authorization` y body JSON.

## 0. Obtener un token

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@infohub.local","password":"infohub2026"}'
# Copiá el "token" de la respuesta:
TOKEN=pegá_acá_el_token
```

## 1. Autenticación

```bash
# 401 — sin token
curl http://localhost:3000/api/data-sources

# 401 — contraseña incorrecta (mismo mensaje que email inexistente)
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@infohub.local","password":"mala1234"}'

# 201 — registro. "rol":"admin" se descarta por matchedData → entra como editor
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"nombre":"Sofía","email":"sofia@coop.org","password":"segura123","rol":"admin","tipo_organizacion":"institucion"}'

# 400 — varios errores juntos (nombre vacío, email repetido, clave corta, tipo inválido)
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"nombre":"","email":"sofia@coop.org","password":"123","tipo_organizacion":"banco"}'
```

## 2. Fuentes de datos (N:M con categorías)

```bash
# 400 — identificador duplicado (se normaliza a mayúsculas: cuotas-2026-09 = CUOTAS-2026-09)
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"Dup","identificador":"cuotas-2026-09","tipo_fuente":"planilla","contenido_crudo":"a,b\n1,2"}'

# 400 — formato de identificador, tipo inválido, contenido vacío, categoría inexistente
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"Mal","identificador":"con espacios!","tipo_fuente":"fax","contenido_crudo":"","categorias":[1,99]}'

# 201 — alta con categorías. "user_id":999 se ignora: el autor sale del token
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"Asistencia a talleres","identificador":"TALLER-2026-09","tipo_fuente":"formulario","contenido_crudo":"fecha,taller,asistentes\n2026-09-02,Huerta,12\n2026-09-09,Huerta,15\n2026-09-16,Costura,8","metadata":{"origen":"Google Forms"},"categorias":[2],"user_id":999}'

# 409 — PUT con un identificador que ya usa otra fuente
curl -X PUT http://localhost:3000/api/data-sources/4 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"identificador":"VENTAS-2026-S38"}'

# 200 — actualización parcial: cambia título y reemplaza categorías en la tabla pivote
curl -X PUT http://localhost:3000/api/data-sources/4 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"Asistencia a talleres comunitarios","categorias":[1,2]}'

# 200 — filtros combinados
curl "http://localhost:3000/api/data-sources?category_id=1&q=cuotas" -H "Authorization: Bearer $TOKEN"

# 200 — análisis automático: métricas + resumen sugerido
curl -X POST http://localhost:3000/api/data-sources/4/analizar -H "Authorization: Bearer $TOKEN"
```

## 3. Reportes

```bash
# 400 — sin fuente (regla de negocio)
curl -X POST http://localhost:3000/api/reports -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"resumen_ejecutivo":"Sin fuente asociada","metricas_clave":{}}'

# 400 — fuente inexistente
curl -X POST http://localhost:3000/api/reports -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"resumen_ejecutivo":"Fuente que no existe","metricas_clave":{"x":1},"data_source_id":999}'

# 201 — alta correcta (user_id = usuario activo del token)
curl -X POST http://localhost:3000/api/reports -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"resumen_ejecutivo":"La asistencia a huerta creció.","metricas_clave":{"filas":3},"data_source_id":4,"estado":"publicado"}'

# 409 — no se elimina una fuente con reportes activos
curl -X DELETE http://localhost:3000/api/data-sources/4 -H "Authorization: Bearer $TOKEN"

# 200 — baja lógica del reporte y luego de la fuente; 404 al buscarla
curl -X DELETE http://localhost:3000/api/reports/2 -H "Authorization: Bearer $TOKEN"
curl -X DELETE http://localhost:3000/api/data-sources/4 -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/api/data-sources/4 -H "Authorization: Bearer $TOKEN"
```

## 4. Usuarios, perfil y roles

```bash
curl -X PUT http://localhost:3000/api/users/1 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"rol":"lector"}'   # 400: no podés quitarte el admin
curl -X DELETE http://localhost:3000/api/users/1 -H "Authorization: Bearer $TOKEN"                                                           # 400: no podés darte de baja
curl -X PUT http://localhost:3000/api/profile -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"moneda":"usd"}'    # 200: moneda → USD

# Con el token de lector@infohub.local:
#   POST /api/categories → 403   ·   GET /api/users → 403   ·   GET /api/reports → 200
```

## 5. Errores generales

```bash
curl http://localhost:3000/api/nada -H "Authorization: Bearer $TOKEN"     # 404 JSON
```

## Verificar en la base

```sql
SELECT id, identificador, deletedAt FROM data_sources;   -- bajas lógicas con fecha
SELECT * FROM data_source_categories;                     -- tabla pivote N:M
SELECT id, email, rol, LEFT(password, 7) FROM users;      -- contraseñas hasheadas ($2a$10$)
```

## Checklist de evaluación

- [x] **ES Modules**: `"type": "module"` en backend y frontend; ningún `require`.
- [x] **dotenv** centralizado en `src/config/env.js`; `.env.example` sin datos sensibles; `.env` en `.gitignore`.
- [x] **Arquitectura por capas**: config · models · validators · middlewares · controllers · routes.
- [x] **Soft delete**: `paranoid: true` en User, Profile, Category, DataSource y Report; `Modelo.destroy({ where: { id } })`.
- [x] **Asociaciones centralizadas** en `models/index.js`; ningún modelo importa a otro.
- [x] **1:1** `hasOne`/`belongsTo` (User–Profile) · **1:N** `hasMany`/`belongsTo` · **N:M** dos `belongsToMany` con `through`.
- [x] **FK snake_case**: `user_id`, `data_source_id`, `category_id`. **Alias** en todas las relaciones.
- [x] **Eager loading** con `attributes` mínimos y `through: { attributes: [] }`; nunca se expone `password`.
- [x] **express-validator**: reglas por entidad, `validateRequest`, `.optional()` en PUT, `.custom(async)` para unicidad y existencia.
- [x] **matchedData** en todos los POST/PUT: campos inyectados (`rol`, `user_id`) descartados.
- [x] **Códigos HTTP**: 200, 201, 400, 401, 403, 404, 409, 500; `try/catch` en cada método.
- [x] **Reglas de negocio**: identificador y email únicos; reporte con usuario activo y fuente existente; bajas lógicas.
- [x] **Frontend React**: `services/api.js`, Login, Dashboard de reportes, gestión de fuentes, modales, confirmación, avisos, spinners y estados vacíos; errores de express-validator mostrados bajo cada campo.
- [x] **Gitflow**: `main`, `develop`, 5 ramas `feature/*`, merges `--no-ff`, commits en español, tag `v1.0.0`.

---

# Pruebas de la versión 2

Con `IA_PROVEEDOR=simulado` se pueden correr sin internet. Con una clave real de Gemini, las respuestas son reales.
Los archivos de ejemplo están en `backend/scripts/ejemplos/`.

## Estado de la IA

```bash
curl http://localhost:3000/api/ia/estado -H "Authorization: Bearer $TOKEN"
# {"configurada":true,"proveedor":"gemini","modelo":"gemini-3.8-flash","motivo":null}
```

## Subir archivos de cualquier tipo (multipart, sin límite de tamaño)

```bash
# 201 — Excel con categorías. Título = nombre del archivo; identificador automático (PLA-AAAAMMDD-XXXXXX)
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@backend/scripts/ejemplos/tesoreria-2026.xlsx" -F "categorias=1" -F "categorias=3"

# 201 — JSON con título propio
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@backend/scripts/ejemplos/ventas-semana.json" -F "titulo=Ventas del almacén"

# 201 — PDF, foto, audio o video: la IA los identifica en segundo plano
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -F "archivo=@acta.pdf"
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -F "archivo=@audio-asamblea.opus"

# 201 — texto pegado (JSON)
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"texto":"producto,cantidad\nyerba,3\nazucar,5","titulo":"Pegado a mano"}'

# 400 — sin archivo ni texto, y título demasiado corto
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -F "titulo=x"

# 400 — categoría inexistente (el archivo subido se borra del disco)
curl -X POST http://localhost:3000/api/data-sources -H "Authorization: Bearer $TOKEN" -F "archivo=@foto.png" -F "categorias=99"
```

La respuesta trae `"estado_ia": "pendiente"`. Unos segundos después:

```bash
curl http://localhost:3000/api/data-sources/ID -H "Authorization: Bearer $TOKEN"
# estado_ia: "listo" · descripcion_ia · sugerencias · contenido_crudo (texto o transcripción)
```

## Reintentar, descargar, editar

```bash
curl -X POST http://localhost:3000/api/data-sources/ID/procesar -H "Authorization: Bearer $TOKEN"     # 200 (409 si ya se está procesando)
curl -o original.png http://localhost:3000/api/data-sources/ID/archivo -H "Authorization: Bearer $TOKEN"  # descarga el original
# 200 — el identificador NO se puede cambiar (se ignora)
curl -X PUT http://localhost:3000/api/data-sources/ID -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"Cuotas - septiembre","categorias":[2],"identificador":"HACK-1"}'
```

## Reportes a pedido

```bash
# 200 — borrador según lo que pregunta el usuario (NO se guarda)
curl -X POST http://localhost:3000/api/reports/generar -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"data_source_id":1,"consulta":"¿Qué socios deben la cuota y cuánto suma la deuda?"}'

# 400 — consulta demasiado corta / fuente inexistente
curl -X POST http://localhost:3000/api/reports/generar -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"data_source_id":1,"consulta":"hola"}'
curl -X POST http://localhost:3000/api/reports/generar -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"data_source_id":999,"consulta":"¿Cuánto se vendió?"}'

# 409 — la fuente todavía se está procesando
# 429 — se agotó la cuota gratuita de la IA (esperar un minuto)
# 503 — IA sin configurar y la fuente es PDF/imagen/audio/video, o clave inválida

# 201 — guardar el borrador revisado: se manda lo que devolvió /generar + estado
curl -X POST http://localhost:3000/api/reports -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"data_source_id":1,"consulta":"...","titulo":"...","resumen_ejecutivo":"...","metricas_clave":{...},"origen":"ia","modelo_ia":"gemini-3.8-flash","estado":"publicado"}'
```

## Checklist adicional v2

- [x] Subida `multipart` a disco sin límite de tamaño; archivo borrado si la validación falla.
- [x] Detección de tipo por extensión/MIME; extracción local de CSV, JSON, Excel, Word y texto.
- [x] PDF, imágenes, audio y video identificados por IA (Files API) en segundo plano, con estados.
- [x] Identificador generado automáticamente e inmutable; título tomado del nombre del archivo.
- [x] Campos "origen" y "responsable" eliminados.
- [x] Reportes según la consulta del usuario, con indicadores, hallazgos, recomendaciones y tabla.
- [x] Cálculos exactos hechos localmente y pasados a la IA (no inventa cifras).
- [x] Funciona sin IA (reporte básico) y con un proveedor simulado para demos.
- [x] Rutas internas y referencias de IA nunca expuestas al cliente.
- [x] Migración SQL de v1 a v2 sin pérdida de datos.
