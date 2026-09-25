import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

// Tabla pivote N:M: un reporte puede basarse en VARIAS fuentes
// (comparaciones y consolidaciones). Los reportes de una sola fuente
// siguen usando data_source_id como siempre.
export const ReportSource = sequelize.define(
  'ReportSource',
  {
    report_id: { type: DataTypes.INTEGER, primaryKey: true },
    data_source_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  { tableName: 'report_sources', timestamps: true }
);
