import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/db.js';

export const ROLES = ['admin', 'editor', 'lector'];

export const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'El nombre no puede estar vacío' },
        len: { args: [2, 100], msg: 'El nombre debe tener entre 2 y 100 caracteres' },
      },
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: { name: 'uq_users_email', msg: 'Ya existe un usuario con ese email' },
      validate: { isEmail: { msg: 'El email no tiene un formato válido' } },
    },
    password: { type: DataTypes.STRING(255), allowNull: false },
    rol: {
      type: DataTypes.ENUM(...ROLES),
      allowNull: false,
      defaultValue: 'editor',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    paranoid: true,
    // Nunca se trae la contraseña salvo que se pida el scope explícito
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { conPassword: {} },
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

User.prototype.validarPassword = function (plano) {
  return bcrypt.compare(plano, this.password);
};

// Segunda barrera: aunque la instancia tenga el hash, no sale en el JSON
User.prototype.toJSON = function () {
  const valores = { ...this.get() };
  delete valores.password;
  return valores;
};
