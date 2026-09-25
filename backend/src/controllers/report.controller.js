import { matchedData } from 'express-validator';
import { Report, DataSource, User } from '../models/index.js';
import { generarBorrador } from '../services/reportes.service.js';
import { ErrorIA, traducirError } from '../services/ia/errores.js';

const INCLUDES = [
  { model: DataSource, as: 'fuente', attributes: ['id', 'titulo', 'identificador', 'tipo_fuente'] },
  { model: User, as: 'autor', attributes: ['id', 'nombre'], paranoid: false },
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
    const cleanData = matchedData(req);
    const nuevo = await Report.create({ ...cleanData, user_id: req.user.id });
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
