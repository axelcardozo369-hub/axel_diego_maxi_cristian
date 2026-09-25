import { matchedData } from 'express-validator';
import { Op } from 'sequelize';
import { sequelize, Report, DataSource, User } from '../models/index.js';
import { generarBorrador } from '../services/reportes.service.js';
import { generarBorradorMultiple } from '../services/reportesMultiples.service.js';
import { generarPDFReporte } from '../services/pdf.service.js';
import { ErrorIA, traducirError } from '../services/ia/errores.js';

const INCLUDES = [
  { model: DataSource, as: 'fuente', attributes: ['id', 'titulo', 'identificador', 'tipo_fuente'] },
  { model: User, as: 'autor', attributes: ['id', 'nombre'], paranoid: false },
  // Reportes de varias fuentes (vacío en los de una sola fuente)
  { model: DataSource, as: 'fuentes', attributes: ['id', 'titulo', 'identificador', 'tipo_fuente'], through: { attributes: [] }, paranoid: false },
];

const buscarConRelaciones = (id) => Report.findByPk(id, { include: INCLUDES });

// GET /api/reports?estado=&data_source_id=
export const getReports = async (req, res) => {
  try {
    const filtros = matchedData(req, { locations: ['query'] });
    const reportes = await Report.findAll({ where: filtros, include: INCLUDES, order: [['updatedAt', 'DESC']] });
    return res.status(200).json(reportes);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// GET /api/reports/:id
export const getReportById = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const reporte = await buscarConRelaciones(id);
    if (!reporte) return res.status(404).json({ message: 'Reporte no encontrado' });
    return res.status(200).json(reporte);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/reports/generar
// La IA responde la consulta del usuario. Devuelve un BORRADOR: no se guarda
// hasta que la persona lo revisa y confirma (POST /api/reports).
export const generarReporte = async (req, res) => {
  try {
    const { data_source_id, consulta } = matchedData(req);
    const fuente = await DataSource.findByPk(data_source_id);
    if (!fuente) return res.status(404).json({ message: 'Fuente de datos no encontrada' });
    if (['pendiente', 'procesando'].includes(fuente.estado_ia)) {
      return res.status(409).json({ message: 'La fuente todavía se está procesando. Esperá unos segundos.' });
    }

    const { borrador, ia_archivo, aviso } = await generarBorrador({ fuente, consulta });
    // Si hubo que volver a subir el archivo a la IA, se guarda la nueva referencia
    if (ia_archivo) await fuente.update({ ia_archivo }, { silent: true });

    // aviso: si la IA no respondió y contestó el motor local, se explica por qué
    return res.status(200).json({ ...borrador, aviso });
  } catch (error) {
    if (error instanceof ErrorIA || error?.status) {
      const e = traducirError(error);
      return res.status(e.status).json({ message: e.message });
    }
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/reports
// Regla: usuario ACTIVO (verificarToken) + fuente EXISTENTE (validador)
export const createReport = async (req, res) => {
  try {
    const { data_source_ids, ...cleanData } = matchedData(req);
    const nuevo = await sequelize.transaction(async (transaction) => {
      const reporte = await Report.create({ ...cleanData, user_id: req.user.id }, { transaction });
      // Reporte de varias fuentes: se guardan todas en la tabla pivote
      if (data_source_ids?.length) await reporte.setFuentes(data_source_ids, { transaction });
      return reporte;
    });
    return res.status(201).json(await buscarConRelaciones(nuevo.id));
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// PUT /api/reports/:id
export const updateReport = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const cleanData = matchedData(req, { locations: ['body'] });
    const reporte = await Report.findByPk(id);
    if (!reporte) return res.status(404).json({ message: 'Reporte no encontrado' });
    await reporte.update(cleanData);
    return res.status(200).json(await buscarConRelaciones(id));
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// DELETE /api/reports/:id  (baja lógica)
export const deleteReport = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const reporte = await Report.findByPk(id);
    if (!reporte) return res.status(404).json({ message: 'Reporte no encontrado' });
    await Report.destroy({ where: { id } });
    return res.status(200).json({ message: 'Reporte eliminado correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/reports/generar-multiple
// Compara, consolida o consulta VARIAS fuentes. Devuelve un BORRADOR para revisar.
export const generarReporteMultiple = async (req, res) => {
  try {
    const { data_source_ids, modo, consulta } = matchedData(req);
    const encontradas = await DataSource.findAll({ where: { id: { [Op.in]: data_source_ids } } });
    // Se respeta el orden en que el usuario eligió las fuentes (importa al comparar)
    const fuentes = data_source_ids.map((id) => encontradas.find((f) => f.id === id));
    const enProceso = fuentes.filter((f) => ['pendiente', 'procesando'].includes(f.estado_ia));
    if (enProceso.length) {
      return res.status(409).json({ message: `Todavía se están procesando: ${enProceso.map((f) => f.titulo).join(', ')}. Esperá unos segundos.` });
    }
    const { borrador, aviso } = await generarBorradorMultiple({ fuentes, consulta, modo });
    return res.status(200).json({ ...borrador, aviso });
  } catch (error) {
    if (error instanceof ErrorIA) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// GET /api/reports/:id/pdf — descarga el reporte en PDF
export const descargarPDF = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const reporte = await buscarConRelaciones(id);
    if (!reporte) return res.status(404).json({ message: 'Reporte no encontrado' });
    const nombre = `${(reporte.titulo || 'reporte').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'reporte'}-${reporte.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    generarPDFReporte(reporte.toJSON(), res);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    res.end();
  }
};
