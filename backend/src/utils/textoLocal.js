// ============================================================
// Herramientas de texto 100% locales (sin IA, sin internet, sin cuota).
// Sirven para: describir una fuente, sugerir preguntas y encontrar
// los fragmentos que responden a una consulta.
// ============================================================

const STOPWORDS = new Set(`a al algo algunas algunos ante antes aqui asi aun bajo bien cada casi como con contra cual cuales cuando de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estado estan estar estas este esto estos fue fueron ha hace hacer han hasta hay la las le les lo los mas me mi mientras mismo muy nada ni no nos o otra otras otro otros para pero poco por porque que quien se sea segun ser si sido sin sobre solo son su sus tambien tan tanto te tiene tienen todo todos tu un una unas uno unos usted ya yo cuanto cuanta cuantos cuantas cual quiero saber dame decime muestra mostrame the and of to in is for on with that this are be as it by from`.split(/\s+/));

// Minúsculas y sin tildes: "Cuántos" y "cuantos" son lo mismo
export const normalizar = (texto = '') => String(texto)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export const palabras = (texto) => normalizar(texto).match(/[a-z0-9ñ]{3,}/g) || [];

// Raíz aproximada: "deben", "debe", "deudores" → "debe"/"deud".
// No es perfecta, pero alcanza para buscar coincidencias en español.
export const raiz = (palabra) => (palabra.length > 5 ? palabra.slice(0, 5) : palabra.slice(0, 4));

export const terminosDeConsulta = (consulta) => [...new Set(
  palabras(consulta).filter((p) => !STOPWORDS.has(p)).map(raiz)
)];

// Las palabras más frecuentes (sin conectores): sirven como "temas" del texto
export function palabrasClave(texto, cantidad = 8) {
  const conteo = new Map();
  for (const p of palabras(texto.slice(0, 300_000))) {
    if (STOPWORDS.has(p) || /^\d+$/.test(p) || p.length < 4) continue;
    conteo.set(p, (conteo.get(p) || 0) + 1);
  }
  // "archivo" y "archivos" cuentan como un mismo tema (misma raíz)
  const porRaiz = new Map();
  for (const [p, n] of [...conteo.entries()].sort((a, b) => b[1] - a[1])) {
    const r = raiz(p);
    const previo = porRaiz.get(r);
    porRaiz.set(r, previo ? { palabra: previo.palabra, n: previo.n + n } : { palabra: p, n });
  }
  return [...porRaiz.values()].sort((a, b) => b.n - a.n).slice(0, cantidad).map((x) => x.palabra);
}

// Divide el texto en fragmentos de ~1.200 caracteres respetando párrafos
export function dividirEnFragmentos(texto, tamano = 1200) {
  const parrafos = String(texto).split(/\n\s*\n|\r?\n(?=\S)/).map((p) => p.trim()).filter(Boolean);
  const fragmentos = [];
  let actual = '';
  for (const p of parrafos) {
    if ((actual + '\n' + p).length > tamano && actual) {
      fragmentos.push(actual);
      actual = p;
    } else {
      actual = actual ? `${actual}\n${p}` : p;
    }
    while (actual.length > tamano * 2) { // párrafos gigantes
      fragmentos.push(actual.slice(0, tamano));
      actual = actual.slice(tamano);
    }
  }
  if (actual) fragmentos.push(actual);
  return fragmentos;
}

const puntaje = (fragmento, terminos) => {
  const norm = normalizar(fragmento);
  return terminos.reduce((total, t) => total + (norm.split(t).length - 1), 0);
};

// Búsqueda por relevancia: los fragmentos con más coincidencias con la consulta.
// Así a la IA se le manda solo lo necesario (menos tokens = menos 429).
export function fragmentosRelevantes(texto, consulta, maxCaracteres = 20_000) {
  const fragmentos = dividirEnFragmentos(texto);
  const terminos = terminosDeConsulta(consulta);
  if (fragmentos.length === 0) return { texto: '', coincidencias: 0, fragmentos: [] };

  const puntuados = fragmentos.map((f, i) => ({ f, i, p: terminos.length ? puntaje(f, terminos) : 0 }));
  const conCoincidencia = puntuados.filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
  // Siempre se incluye el comienzo (suele tener título y contexto)
  const elegidos = [puntuados[0], ...conCoincidencia.filter((x) => x.i !== 0)];
  if (conCoincidencia.length === 0) elegidos.push(...puntuados.slice(1)); // sin coincidencias: en orden

  const salida = [];
  let largo = 0;
  for (const x of elegidos) {
    if (largo + x.f.length > maxCaracteres) break;
    salida.push(x);
    largo += x.f.length;
  }
  salida.sort((a, b) => a.i - b.i); // se devuelven en el orden original
  return {
    texto: salida.map((x) => x.f).join('\n[...]\n'),
    coincidencias: conCoincidencia.length,
    fragmentos: conCoincidencia.slice(0, 5).map((x) => x.f),
  };
}

// Muestra representativa para identificar un documento largo con pocos tokens
export function muestra(texto, maxCaracteres = 10_000) {
  if (texto.length <= maxCaracteres) return texto;
  const parte = Math.floor(maxCaracteres / 3);
  const medio = Math.floor(texto.length / 2);
  return `${texto.slice(0, parte)}\n[...]\n${texto.slice(medio - parte / 2, medio + parte / 2)}\n[...]\n${texto.slice(-parte)}`;
}

// Descripción y preguntas sugeridas SIN IA
export function describirLocalmente({ texto, tipo, titulo, detalle = {} }) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  const cantPalabras = (texto.match(/\S+/g) || []).length;
  const temas = palabrasClave(texto, 6);
  const primera = lineas.find((l) => l.trim().length > 20)?.trim().slice(0, 100);

  const partes = [];
  if (tipo === 'pdf' && detalle.paginas) partes.push(`PDF de ${detalle.paginas} página${detalle.paginas === 1 ? '' : 's'} con unas ${cantPalabras.toLocaleString('es-AR')} palabras.`);
  else partes.push(`Documento de unas ${cantPalabras.toLocaleString('es-AR')} palabras en ${lineas.length} líneas.`);
  if (primera) partes.push(`Comienza con: "${primera}".`);
  if (temas.length) partes.push(`Temas frecuentes: ${temas.join(', ')}.`);

  return {
    descripcion: partes.join(' '),
    sugerencias: [
      `¿Cuáles son los puntos principales de "${titulo}"?`,
      ...temas.slice(0, 2).map((t) => `¿Qué dice sobre ${t}?`),
    ],
  };
}
