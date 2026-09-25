import { sequelize } from '../config/db.js';
import { User } from './User.js';
import { Profile } from './Profile.js';
import { Category } from './Category.js';
import { DataSource } from './DataSource.js';
import { DataSourceCategory } from './DataSourceCategory.js';
import { Report } from './Report.js';

// ============================================================
// ASOCIACIONES CENTRALIZADAS
// Ningún modelo importa a otro: todas las relaciones viven acá
// para evitar dependencias circulares.
// ============================================================

// ---------- 1:1  User ── Profile ----------
User.hasOne(Profile, {
  foreignKey: { name: 'user_id', allowNull: false },
  as: 'perfil',
  onDelete: 'RESTRICT',
});
Profile.belongsTo(User, { foreignKey: { name: 'user_id', allowNull: false }, as: 'usuario' });

// ---------- 1:N  User ── DataSource ----------
User.hasMany(DataSource, {
  foreignKey: { name: 'user_id', allowNull: false },
  as: 'fuentes',
  onDelete: 'RESTRICT',
});
DataSource.belongsTo(User, { foreignKey: { name: 'user_id', allowNull: false }, as: 'autor' });

// ---------- 1:N  User ── Report ----------
User.hasMany(Report, {
  foreignKey: { name: 'user_id', allowNull: false },
  as: 'reportes',
  onDelete: 'RESTRICT',
});
Report.belongsTo(User, { foreignKey: { name: 'user_id', allowNull: false }, as: 'autor' });

// ---------- 1:N  DataSource ── Report ----------
DataSource.hasMany(Report, {
  foreignKey: { name: 'data_source_id', allowNull: false },
  as: 'reportes',
  onDelete: 'RESTRICT',
});
Report.belongsTo(DataSource, { foreignKey: { name: 'data_source_id', allowNull: false }, as: 'fuente' });

// ---------- N:M  DataSource ── Category (tabla pivote) ----------
DataSource.belongsToMany(Category, {
  through: DataSourceCategory,
  foreignKey: 'data_source_id',
  otherKey: 'category_id',
  as: 'categorias',
});
Category.belongsToMany(DataSource, {
  through: DataSourceCategory,
  foreignKey: 'category_id',
  otherKey: 'data_source_id',
  as: 'fuentes',
});

export { sequelize, User, Profile, Category, DataSource, DataSourceCategory, Report };
