import path from 'node:path';
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import { env } from '../config/env.js';
import { jsonField } from '../utils/jsonField.js';
import { TIPOS_FUENTE } from '../utils/tiposArchivo.js';
import { generarIdentificador } from '../utils/identificador.js';

export { TIPOS_FUENTE };
export const ESTADOS_IA = ['pendiente', 'procesando', 'listo', 'sin_ia', 'error'];

// Fuente de datos: el archivo original (cualquier formato) + lo que se
// pudo extraer de él (texto, transcripción, tablas) + la identificación de la IA
export const DataSource = sequelize.define(
  'DataSource',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titulo: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: { msg: 'El título no puede estar vacío' } },
    },
    // Regla de negocio: único. Se genera solo (PDF-20260924-K7Q2M9)
    identificador: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: { name: 'uq_data_sources_identificador', msg: 'Ya existe una fuente con ese identificador' },
    },
    tipo_fuente: {
      type: DataTypes.ENUM(...TIPOS_FUENTE),
      allowNull: false,
      defaultValue: 'otro',
    },
    // ---------- Archivo original ----------
    archivo_nombre: { type: DataTypes.STRING(255), allowNull: true },
    // Se guarda solo el nombre en disco; al leerlo devuelve la ruta completa
    archivo_ruta: {
      type: DataTypes.STRING(500),
      allowNull: true,
      get() {
        const guardado = this.getDataValue('archivo_ruta');
        return guardado ? path.resolve(env.UPLOADS_DIR, guardado) : null;
      },
    },
    mime_type: { type: DataTypes.STRING(150), allowNull: true },
    tamano_bytes: { type: DataTypes.BIGINT, allowNull: true },
    // ---------- Contenido utilizable ----------
    // Texto del archivo, o lo que la IA transcribió/extrajo si era PDF, imagen, audio o video
    contenido_crudo: { type: DataTypes.TEXT('long'), allowNull: true },
    // ---------- Identificación con IA ----------
    estado_ia: {
      type: DataTypes.ENUM(...ESTADOS_IA),
      allowNull: false,
      defaultValue: 'pendiente',
    },
    descripcion_ia: { type: DataTypes.TEXT, allowNull: true },
    error_ia: { type: DataTypes.TEXT, allowNull: true },
    sugerencias: jsonField('sugerencias', { allowNull: true }), // Preguntas sugeridas
    ia_archivo: jsonField('ia_archivo', { allowNull: true }), // Referencia al archivo en la IA (vence)
    metadata: jsonField('metadata', { allowNull: true }), // Datos técnicos (extensión, hojas, etc.)
    user_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: 'data_sources',
    timestamps: true,
    paranoid: true,
    hooks: {
      // Identificador automático: el usuario nunca lo escribe
      beforeValidate: (fuente) => {
        if (!fuente.identificador) fuente.identificador = generarIdentificador(fuente.tipo_fuente);
      },
    },
  }
);
