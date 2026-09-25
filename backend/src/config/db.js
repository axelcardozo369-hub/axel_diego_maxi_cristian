import { Sequelize } from 'sequelize';
import { env } from './env.js';

// Una sola instancia de conexión compartida por todos los modelos
export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  logging: false,
  timezone: '-03:00',
});
