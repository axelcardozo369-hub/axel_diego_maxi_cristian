import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

export const TIPOS_ORGANIZACION = ['emprendimiento', 'organizacion', 'institucion', 'comunidad'];

// Perfil de configuración: relación 1:1 con User
export const Profile = sequelize.define(
  'Profile',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    organizacion: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    tipo_organizacion: {
      type: DataTypes.ENUM(...TIPOS_ORGANIZACION),
      allowNull: false,
      defaultValue: 'organizacion',
    },
    moneda: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'ARS',
      validate: { len: { args: [3, 3], msg: 'La moneda es un código de 3 letras (ej: ARS)' } },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: { name: 'uq_profiles_user' }, // Garantiza el 1:1 en la base
    },
  },
  { tableName: 'profiles', timestamps: true, paranoid: true }
);
