import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import { jsonField } from '../utils/jsonField.js';

export const ESTADOS_REPORTE = ['borrador', 'publicado', 'archivado'];
export const ORIGENES_REPORTE = ['ia', 'local'];

// Reporte útil: la respuesta a lo que el usuario preguntó sobre una fuente
export const Report = sequelize.define(
  'Report',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titulo: { type: DataTypes.STRING(200), allowNull: true },
    // Lo que pidió el usuario: "¿Qué socios deben más de dos cuotas?"
    consulta: { type: DataTypes.TEXT, allowNull: true },
    resumen_ejecutivo: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: { msg: 'El resumen no puede estar vacío' } },
    },
    // Indicadores, hallazgos, recomendaciones y tabla
    metricas_clave: jsonField('metricas_clave', { allowNull: false }),
    estado: {
      type: DataTypes.ENUM(...ESTADOS_REPORTE),
      allowNull: false,
      defaultValue: 'borrador',
    },
    origen: {
      type: DataTypes.ENUM(...ORIGENES_REPORTE),
      allowNull: false,
      defaultValue: 'local',
    },
    modelo_ia: { type: DataTypes.STRING(80), allowNull: true },
    data_source_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'reports', timestamps: true, paranoid: true }
);
