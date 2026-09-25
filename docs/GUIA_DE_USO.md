# Guía de uso de InfoHub

InfoHub junta en un solo lugar la información que hoy está repartida en planillas, archivos y documentos, y la convierte en reportes para decidir.

## 1. Cargar fuentes

**Fuentes de datos → Cargar fuentes**

- Arrastrá **uno o varios archivos** a la vez: CSV, JSON, Excel, Word, PDF, fotos, audios, videos. No hay límite de tamaño.
- Cada archivo se convierte en una fuente, con el título tomado del nombre del archivo (lo podés cambiar) y un identificador automático.
- Las categorías que marques se aplican a todos los archivos de esa carga.
- Si un archivo falla, los demás se cargan igual. El que falló queda marcado en rojo para que lo quites o lo reintentes.

Después de cargarla, cada fuente muestra su estado: **Identificando** mientras se procesa y **Identificada** cuando está lista. Al lado aparece quién la leyó: *Análisis local*, *Gemini* u *OpenRouter*.

## 2. Preguntarle a UNA fuente

**Botón Preguntar** en la fuente, o **Tablero → Nuevo reporte**.

Escribí qué querés saber, por ejemplo "¿Qué socios deben la cuota?". El sistema responde con indicadores, hallazgos, recomendaciones y una tabla. Lo revisás, corregís lo que haga falta y lo guardás.

## 3. Reportes con VARIAS fuentes

Marcá las casillas de 2 o más fuentes en **Fuentes de datos**, o usá **Tablero → Varias fuentes**. Hay tres opciones:

### Comparar (exactamente 2 fuentes)
Para ver **en qué se distinguen**, por ejemplo `ventas.json` y `ventas_limpio.json`. La primera fuente que marcás es la versión original y la segunda la nueva. El reporte muestra:
- registros con el mismo contenido y cuántos solo cambian de **formato** (espacios, mayúsculas, "$ 4.500" contra 4500);
- registros con **valores distintos**, comparando por la columna clave (`id`, `codigo`, etc.), con el antes y el después de cada celda;
- **duplicados quitados**, **celdas vacías** de cada versión y registros nuevos o faltantes;
- columnas que están en una sola de las dos fuentes y diferencias en las sumas.

### Consolidar (2 o más fuentes)
Para **unir** fuentes de distintos formatos (JSON, CSV, Excel) y hacer un **arqueo**:
- reconoce columnas equivalentes aunque tengan otro nombre: `Importe` = `monto`, `Local` = `sucursal`, `Movimiento` / `tipo_movimiento` = `tipo`;
- agrupa por **sucursal** (o por otra columna, si la nombrás en la pregunta);
- calcula **ingresos, egresos y saldo** por grupo, con una fila TOTAL;
- avisa si hay movimientos sin monto y qué grupos aparecen en una sola fuente.

### Preguntar (2 o más fuentes)
Una pregunta libre sobre todas las fuentes juntas, por ejemplo "¿Cuánto se pagó a proveedores en total?". Busca los registros relacionados en cada fuente y suma sus montos.

> Las cifras y las tablas las calcula **siempre** el sistema, de forma exacta. Si la IA está disponible, redacta la respuesta usando esos cálculos. Si no responde (por ejemplo, porque se agotó la cuota gratuita), el reporte lo arma el motor local y un aviso te lo explica.

## 4. Descargar en PDF

En el **Tablero**, cada reporte tiene un botón **PDF**; también está **Descargar PDF** dentro del reporte. El PDF incluye:
- título, tipo de reporte, fuentes, autor y fecha;
- la pregunta y la respuesta;
- indicadores, hallazgos y recomendaciones;
- **todas las tablas**, con la fila TOTAL resaltada y páginas numeradas.

Funciona con los reportes nuevos y con todos los anteriores.

## 5. Si algo no anda

- **Una fuente queda en "Identificando" mucho tiempo:** los audios y videos largos tardan. Las planillas y los PDF con texto tardan segundos.
- **"La IA no respondió":** no es un error. Se usó el motor local. Podés revisar el estado en **Cómo funciona la IA → Probar conexión**.
- **No puedo borrar una fuente:** está usada en algún reporte, incluidos los de varias fuentes. Primero borrá esos reportes.
- **"Para comparar elegí exactamente 2 fuentes":** la comparación es de a dos. Para tres o más, usá Consolidar.
