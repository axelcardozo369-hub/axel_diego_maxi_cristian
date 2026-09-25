import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

export const Category = sequelize.define(
  'Category',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nombre: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: { name: 'uq_categories_nombre', msg: 'Ya existe una categoría con ese nombre' },
      validate: { notEmpty: { msg: 'El nombre no puede estar vacío' } },
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#3346A8',
      validate: { is: { args: /^#[0-9A-Fa-f]{6}$/, msg: 'El color debe ser hexadecimal (#RRGGBB)' } },
    },
  },
  { tableName: 'categories', timestamps: true, paranoid: true }
);
