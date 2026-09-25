import fs from 'node:fs';
import path from 'node:path';
import { matchedData } from 'express-validator';
import { Op } from 'sequelize';
import { sequelize, DataSource, Category, DataSourceCategory, User, Report } from '../models/index.js';
import { analizarContenido, generarResumen } from '../utils/analizador.js';
import { detectarTipo, detectarTipoDeTexto } from '../utils/tiposArchivo.js';
import { nombreOriginal } from '../middlewares/upload.middleware.js';
import { procesarFuente } from '../services/procesador.service.js';
import { textoParaAnalizar } from '../services/extractor.service.js';

// Eager loading con atributos mínimos. through: { attributes: [] } oculta la tabla pivote.
const INCLUDES = [
  { model: User, as: 'autor', attributes: ['id', 'nombre'], paranoid: false },
  { model: Category, as: 'categorias', attributes: ['id', 'nombre', 'color'], through: { attributes: [] } },
];

// Nunca viajan al cliente: la ruta en disco del servidor ni la referencia interna de la IA
const OCULTOS = ['archivo_ruta', 'ia_archivo'];

const TOTAL_REPORTES = [
  sequelize.literal('(SELECT COUNT(*) FROM reports AS r WHERE r.data_source_id = `DataSource`.`id` AND r.deletedAt IS NULL)'),
  'total_reportes',
];

const buscarCompleta = (id) => DataSource.findByPk(id, {
  attributes: { exclude: OCULTOS },
  include: [...INCLUDES, { model: Report, as: 'reportes', attributes: ['id', 'titulo', 'estado', 'updatedAt'] }],
});

const sinExtension = (nombre) => nombre.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

// GET /api/data-sources?q=&tipo_fuente=&estado_ia=&category_id=
export const getDataSources = async (req, res) => {
  try {
    const { q, tipo_fuente, estado_ia, category_id } = matchedData(req, { locations: ['query'] });
    const where = {};
    if (q) where[Op.or] = [{ titulo: { [Op.like]: `%${q}%` } }, { identificador: { [Op.like]: `%${q}%` } }];
    if (tipo_fuente) where.tipo_fuente = tipo_fuente;
    if (estado_ia) where.estado_ia = estado_ia;
    if (category_id) {
      const vinculos = await DataSourceCategory.findAll({ where: { category_id }, attributes: ['data_source_id'] });
      where.id = { [Op.in]: vinculos.map((v) => v.data_source_id) };
    }
    const fuentes = await DataSource.findAll({
      where,
      // En el listado no viaja el contenido (puede pesar mucho)
      attributes: [
        'id', 'titulo', 'identificador', 'tipo_fuente', 'archivo_nombre', 'mime_type', 'tamano_bytes',
        'estado_ia', 'descripcion_ia', 'error_ia', 'sugerencias', 'metadata', 'createdAt', 'updatedAt', TOTAL_REPORTES,
      ],
      include: INCLUDES,
      order: [['createdAt', 'DESC']],
    });
    // Del metadata solo viaja lo que muestra la lista (quién procesó, avisos, reintentos)
    const lista = fuentes.map((f) => {
      const { metadata, ...resto } = f.toJSON();
      const { procesado_por, modelo_ia, ia_aviso, proximo_reintento, paginas } = metadata || {};
      return { ...resto, metadata: { procesado_por, modelo_ia, ia_aviso, proximo_reintento, paginas } };
    });
    return res.status(200).json(lista);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// GET /api/data-sources/:id
export const getDataSourceById = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const fuente = await buscarCompleta(id);
    if (!fuente) return res.status(404).json({ message: 'Fuente de datos no encontrada' });
    return res.status(200).json(fuente);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/data-sources  (multipart/form-data con "archivo", o JSON con "texto")
export const createDataSource = async (req, res) => {
  try {
    const { titulo, texto, categorias = [] } = matchedData(req);
    let datos;

    if (req.file) {
      const nombre = nombreOriginal(req.file);
      const deteccion = detectarTipo(nombre, req.file.mimetype);
      datos = {
        titulo: titulo || sinExtension(nombre) || nombre, // Título = nombre del archivo, salvo que lo cambien
        tipo_fuente: deteccion.tipo_fuente,
        archivo_nombre: nombre,
        archivo_ruta: path.basename(req.file.path),
        mime_type: deteccion.mime_type,
        tamano_bytes: req.file.size,
        metadata: { extension: deteccion.extension },
      };
    } else {
      datos = {
        titulo: titulo || `Texto pegado del ${new Date().toLocaleDateString('es-AR')}`,
        tipo_fuente: detectarTipoDeTexto(texto),
        contenido_crudo: texto,
        tamano_bytes: Buffer.byteLength(texto, 'utf8'),
        metadata: {},
      };
    }

    const fuente = await sequelize.transaction(async (transaction) => {
      // identificador: lo genera el hook del modelo. Autor: sale del token, nunca del body.
      const nueva = await DataSource.create({ ...datos, estado_ia: 'pendiente', user_id: req.user.id }, { transaction });
      await nueva.setCategorias(categorias, { transaction });
      return nueva;
    });

    // Identificación con IA en segundo plano: la respuesta no espera
    setImmediate(() => { procesarFuente(fuente.id); });

    return res.status(201).json(await buscarCompleta(fuente.id));
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// PUT /api/data-sources/:id  (título y categorías; el identificador no se edita)
export const updateDataSource = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const { categorias, ...datos } = matchedData(req, { locations: ['body'] });

    const fuente = await DataSource.findByPk(id);
    if (!fuente) return res.status(404).json({ message: 'Fuente de datos no encontrada' });

    await sequelize.transaction(async (transaction) => {
      await fuente.update(datos, { transaction });
      if (categorias !== undefined) await fuente.setCategorias(categorias, { transaction });
    });
    return res.status(200).json(await buscarCompleta(id));
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// DELETE /api/data-sources/:id  (baja lógica: el archivo se conserva para el historial)
export const deleteDataSource = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const fuente = await DataSource.findByPk(id);
    if (!fuente) return res.status(404).json({ message: 'Fuente de datos no encontrada' });

    const reportesActivos = await Report.count({ where: { data_source_id: id } });
    if (reportesActivos > 0) {
      return res.status(409).json({
        message: `No se puede eliminar: tiene ${reportesActivos} reporte(s) activo(s). Eliminalos primero.`,
      });
    }
    await DataSource.destroy({ where: { id } });
    return res.status(200).json({ message: 'Fuente de datos eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/data-sources/:id/procesar  (reintentar la identificación con IA)
export const reprocesarDataSource = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const fuente = await DataSource.findByPk(id);
    if (!fuente) return res.status(404).json({ message: 'Fuente de datos no encontrada' });
    if (fuente.estado_ia === 'procesando') {
      return res.status(409).json({ message: 'La fuente ya se está procesando' });
    }
    // Reintento manual: se reinicia el contador de reintentos automáticos
    await fuente.update({ estado_ia: 'pendiente', error_ia: null, metadata: { ...(fuente.metadata || {}), reintentos_ia: 0 } }, { silent: true });
    setImmediate(() => { procesarFuente(fuente.id); });
    return res.status(200).json({ message: 'La fuente se está procesando de nuevo', estado_ia: 'pendiente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// GET /api/data-sources/:id/archivo  (descarga del original)
export const descargarArchivo = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const fuente = await DataSource.findByPk(id);
    if (!fuente) return res.status(404).json({ message: 'Fuente de datos no encontrada' });
    if (!fuente.archivo_ruta || !fs.existsSync(fuente.archivo_ruta)) {
      return res.status(404).json({ message: 'Esta fuente no tiene un archivo guardado' });
    }
    return res.download(fuente.archivo_ruta, fuente.archivo_nombre);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/data-sources/:id/analizar  (métricas locales, sin IA)
export const analizarDataSource = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const fuente = await DataSource.findByPk(id);
    if (!fuente) return res.status(404).json({ message: 'Fuente de datos no encontrada' });
    const texto = textoParaAnalizar(fuente);
    if (!texto) return res.status(400).json({ message: 'Esta fuente todavía no tiene contenido para analizar' });

    const metricas_clave = analizarContenido(texto);
    return res.status(200).json({
      data_source_id: fuente.id,
      metricas_clave,
      resumen_sugerido: generarResumen(metricas_clave, fuente.titulo),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
