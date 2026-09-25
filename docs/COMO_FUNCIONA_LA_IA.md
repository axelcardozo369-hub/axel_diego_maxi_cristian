# Cómo funciona la IA en InfoHub (v2.1)

## El problema que había

La pantalla mostraba **"Se alcanzó el límite gratuito de la IA"** y la fuente quedaba en **Error**. Las causas eran cuatro:

1. **Todo dependía de la IA.** Un PDF se mandaba entero a Gemini como archivo, y además se le pedía que devolviera todo su texto. Si Gemini no respondía, la fuente no servía para nada.
2. **Los reintentos gastaban la cuota.** Ante un 429 se reintentaba 3 veces seguidas con el mismo modelo: eran tres pedidos más que volvían a fallar.
3. **El respaldo de OpenRouter no servía para PDF.** Solo actuaba con texto, y el PDF viajaba como archivo.
4. **`server.js` tenía `sequelize.sync({ force: true })`.** Eso **borra todas las tablas y los datos** cada vez que arranca el servidor. Ya está corregido.

## Cómo funciona ahora

```
Subís un archivo
      │
      ▼
1. LECTURA LOCAL  (gratis, sin límite, sin internet)
   CSV · JSON · Excel · Word · PDF con texto  →  texto  →  fuente LISTA
      │
      ▼
2. IA COMO MEJORA (opcional)
   Se manda una MUESTRA de 8.000 caracteres como máximo  →  mejor descripción
      │   falla o sin cuota
      ▼
   Se queda la descripción local + aviso "La IA no respondió"
   (botón "Mejorar con IA" para intentarlo después)

Hacés una pregunta
      │
      ▼
El sistema busca en la fuente SOLO lo relacionado con la pregunta
(filas que coinciden o fragmentos relevantes) y calcula las cifras exactas
      │
      ▼
Gemini (modelo 1 → modelo 2) → OpenRouter → MOTOR LOCAL
  cada proveedor sin cuota queda "en pausa" y no se lo vuelve a llamar
  hasta que pase la espera
```

### Qué necesita IA y qué no

| Fuente | Sin IA | Con IA |
|---|---|---|
| CSV, JSON, Excel | Lectura, totales, búsqueda por pregunta | + respuesta redactada |
| Word, TXT | Lectura, temas, fragmentos relevantes | + respuesta redactada |
| PDF con texto | Lectura local (páginas, temas, fragmentos) | + respuesta redactada |
| PDF escaneado, fotos | Se guarda | La IA lo lee (solo Gemini) |
| Audio, video | Se guarda | La IA lo transcribe (solo Gemini) |

Si una foto, un audio o un video se queda sin cuota, **se reintenta solo** hasta 3 veces, esperando lo que pide el proveedor. La fila muestra "Reintenta 19:32".

### El motor local responde preguntas

Aun sin IA, los reportes tienen en cuenta la pregunta:
- **Planillas:** encuentra las filas que mencionan lo preguntado y suma sus columnas numéricas. Por ejemplo, "¿Qué socios deben?" da 3 filas y $ 3.000.
- **Textos y PDF:** muestra los fragmentos que más coinciden con la pregunta y los temas principales.

## Archivos principales

| Archivo | Qué hace |
|---|---|
| `backend/src/utils/textoLocal.js` | Búsqueda de fragmentos relevantes, temas y descripción local |
| `backend/src/services/extractor.service.js` | Lee PDF (unpdf), Excel, Word, CSV y JSON localmente |
| `backend/src/services/procesador.service.js` | Local primero, IA opcional, reintento automático |
| `backend/src/services/reportes.service.js` | Arma el contexto chico para la IA y el motor local |
| `backend/src/services/ia/index.js` | Cadena de proveedores, pausas por cuota y prueba de conexión |
| `backend/src/services/ia/uso.js` | Registro de llamadas que muestra la página "Cómo funciona la IA" |
| `frontend/src/pages/IA.jsx` | Página con el recorrido, el estado en vivo y el botón "Probar conexión" |

## Endpoints nuevos

- `GET /api/ia/estado`: proveedores, modelos, pausas por cuota, uso del día y últimas llamadas.
- `POST /api/ia/probar` (admin): un pedido mínimo a cada proveedor para saber si la clave, el modelo y la cuota funcionan en este momento.

## Si ves "se agotó la cuota"

1. **No es un error del sistema:** la fuente sigue funcionando con el motor local.
2. Entrá a **Cómo funciona la IA → Probar conexión** para ver qué proveedor responde.
3. En **Google AI Studio** revisá los límites de tu proyecto. Si un modelo tiene poca cuota, poné otro primero en `GEMINI_MODEL`.
4. En **OpenRouter**, sin créditos comprados el plan gratis permite 50 pedidos por día.
