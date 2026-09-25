import { Op } from 'sequelize';
import { sequelize, DataSource, Report, Category } from '../models/index.js';
import { estadoIA } from '../services/ia/index.js';

const DIAS_DESACTUALIZADA = 30;

// GET /api/dashboard
// La "foto" de la organización: qué hay cargado, qué falta procesar y qué está viejo
export const getResumen = async (req, res) => {
  try {
    const limite = new Date(Date.now() - DIAS_DESACTUALIZADA * 24 * 60 * 60 * 1000);

    const [totalFuentes, totalReportes, porEstado, porTipo, sinReporte, desactualizadas, totalCategorias, enProceso, conError] =
      await Promise.all([
        DataSource.count(),
        Report.count(),
        Report.findAll({
          attributes: ['estado', [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']],
          group: ['estado'],
          raw: true,
        }),
        DataSource.findAll({
          attributes: ['tipo_fuente', [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']],
          group: ['tipo_fuente'],
          raw: true,
        }),
        // Fuentes cargadas que todavía nadie transformó en reporte
        DataSource.findAll({
          attributes: ['id', 'titulo', 'identificador', 'updatedAt'],
          where: sequelize.literal('NOT EXISTS (SELECT 1 FROM reports AS r WHERE r.data_source_id = `DataSource`.`id` AND r.deletedAt IS NULL)'),
          order: [['updatedAt', 'DESC']],
          limit: 5,
        }),
        // Fuentes sin actualizar hace más de 30 días
        DataSource.findAll({
          attributes: ['id', 'titulo', 'identificador', 'updatedAt'],
          where: { updatedAt: { [Op.lt]: limite } },
          order: [['updatedAt', 'ASC']],
          limit: 5,
        }),
        Category.count(),
        DataSource.count({ where: { estado_ia: ['pendiente', 'procesando'] } }),
        DataSource.count({ where: { estado_ia: 'error' } }),
      ]);

    const reportesPorEstado = { borrador: 0, publicado: 0, archivado: 0 };
    porEstado.forEach((f) => { reportesPorEstado[f.estado] = Number(f.cantidad); });

    return res.status(200).json({
      totales: { fuentes: totalFuentes, reportes: totalReportes, categorias: totalCategorias },
      reportes_por_estado: reportesPorEstado,
      fuentes_por_tipo: porTipo.map((f) => ({ tipo_fuente: f.tipo_fuente, cantidad: Number(f.cantidad) })),
      fuentes_sin_reporte: sinReporte,
      fuentes_desactualizadas: desactualizadas,
      dias_desactualizada: DIAS_DESACTUALIZADA,
      fuentes_en_proceso: enProceso,
      fuentes_con_error: conError,
      ia: estadoIA(),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
