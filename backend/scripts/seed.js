// Datos de ejemplo para la demo: una comisión vecinal y un emprendimiento.
// ¡Borra y recrea las tablas! Para probar la subida de archivos, usá los de scripts/ejemplos/.
import fs from 'node:fs/promises';
import { sequelize, User, Profile, Category, DataSource, Report } from '../src/models/index.js';
import { analizarContenido, generarResumen } from '../src/utils/analizador.js';
import { reporteLocal } from '../src/services/reportes.service.js';

const hace = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
const ejemplo = (nombre) => fs.readFile(new URL(`./ejemplos/${nombre}`, import.meta.url), 'utf8');

try {
  await sequelize.sync({ force: true });

  const admin = await User.create({ nombre: 'Laura Giménez', email: 'admin@infohub.local', password: 'infohub2026', rol: 'admin' });
  await Profile.create({ organizacion: 'Comisión Vecinal Barrio San Miguel', tipo_organizacion: 'comunidad', user_id: admin.id });
  const editor = await User.create({ nombre: 'Martín Sosa', email: 'editor@infohub.local', password: 'infohub2026', rol: 'editor' });
  await Profile.create({ organizacion: 'Almacén Don Martín', tipo_organizacion: 'emprendimiento', user_id: editor.id });
  const lector = await User.create({ nombre: 'Rocío Paz', email: 'lector@infohub.local', password: 'infohub2026', rol: 'lector' });
  await Profile.create({ organizacion: 'Comisión Vecinal Barrio San Miguel', tipo_organizacion: 'comunidad', user_id: lector.id });

  const [finanzas, socios, ventas, reclamos] = await Category.bulkCreate([
    { nombre: 'Finanzas', color: '#3346A8' },
    { nombre: 'Socios', color: '#0F7B6C' },
    { nombre: 'Ventas', color: '#B4540A' },
    { nombre: 'Reclamos', color: '#8E3B7A' },
  ]);

  const crear = async (datos, categorias) => {
    const f = await DataSource.create({ estado_ia: 'listo', ...datos });
    await f.setCategorias(categorias);
    return f;
  };

  const csvCuotas = await ejemplo('cuotas-septiembre.csv');
  const cuotas = await crear({
    titulo: 'Cuotas sociales de septiembre',
    tipo_fuente: 'planilla',
    archivo_nombre: 'cuotas-septiembre.csv',
    mime_type: 'text/csv',
    tamano_bytes: Buffer.byteLength(csvCuotas),
    contenido_crudo: csvCuotas,
    descripcion_ia: 'Planilla de tesorería con el pago de la cuota social de septiembre: 8 socios, monto y si pagaron o deben.',
    sugerencias: ['¿Qué socios deben la cuota y cuánto suma la deuda?', '¿Cuánto se recaudó en septiembre?', '¿Hay registros duplicados o incompletos?'],
    metadata: { extension: 'csv', tipo_contenido: 'planilla de cuotas sociales' },
    user_id: admin.id,
  }, [finanzas.id, socios.id]);

  const jsonVentas = await ejemplo('ventas-semana.json');
  await crear({
    titulo: 'Ventas de la semana 38',
    tipo_fuente: 'json',
    archivo_nombre: 'ventas-semana.json',
    mime_type: 'application/json',
    tamano_bytes: Buffer.byteLength(jsonVentas),
    contenido_crudo: jsonVentas,
    descripcion_ia: 'Exportación del sistema de caja del almacén: ventas por producto de la semana 38, con cantidad, total y medio de pago.',
    sugerencias: ['¿Qué producto dejó más plata?', '¿Qué medio de pago se usa más?', '¿Qué día se vendió más?'],
    metadata: { extension: 'json', tipo_contenido: 'registro de ventas' },
    user_id: editor.id,
  }, [ventas.id]);

  const acta = await ejemplo('acta-reunion.txt');
  const fuenteActa = await crear({
    titulo: 'Acta de reunión 16/09',
    tipo_fuente: 'texto',
    archivo_nombre: 'acta-reunion.txt',
    mime_type: 'text/plain',
    tamano_bytes: Buffer.byteLength(acta),
    contenido_crudo: acta,
    descripcion_ia: 'Acta de la comisión vecinal del 16 de septiembre: alumbrado de calle Belgrano, cuotas adeudadas, festejo de la primavera y reparación del salón.',
    sugerencias: ['¿Qué tareas quedaron asignadas y a quién?', '¿Qué fechas límite hay?', '¿Qué gastos se mencionan?'],
    metadata: { extension: 'txt', tipo_contenido: 'acta de reunión' },
    user_id: admin.id,
  }, [reclamos.id]);
  // Fuente vieja para que aparezca en "desactualizadas"
  await sequelize.query('UPDATE data_sources SET updatedAt = ? WHERE id = ?', { replacements: [hace(45), fuenteActa.id] });

  const analisis = analizarContenido(csvCuotas);
  const local = reporteLocal(analisis, cuotas);
  const { titulo, resumen_ejecutivo, ...resto } = local;
  await Report.create({
    titulo: 'Estado de cuotas de septiembre',
    consulta: '¿Cómo viene la cobranza de septiembre?',
    resumen_ejecutivo: generarResumen(analisis, cuotas.titulo),
    metricas_clave: { tipo: 'reporte', ...resto, limitaciones: '', analisis_local: { ...analisis, encabezados: undefined } },
    estado: 'publicado',
    origen: 'local',
    data_source_id: cuotas.id,
    user_id: admin.id,
  });

  console.log('✔ Datos de ejemplo cargados');
  console.log('  admin@infohub.local / editor@infohub.local / lector@infohub.local  (clave: infohub2026)');
  console.log('  Archivos para probar la subida: backend/scripts/ejemplos/');
} catch (error) {
  console.error('✖ Error al cargar datos:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
