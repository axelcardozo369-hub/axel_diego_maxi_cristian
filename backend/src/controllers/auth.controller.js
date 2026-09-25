import jwt from 'jsonwebtoken';
import { matchedData } from 'express-validator';
import { UniqueConstraintError } from 'sequelize';
import { env } from '../config/env.js';
import { sequelize, User, Profile } from '../models/index.js';

const PERFIL = { model: Profile, as: 'perfil', attributes: ['id', 'organizacion', 'tipo_organizacion', 'moneda'] };

const firmarToken = (usuario) =>
  jwt.sign({ id: usuario.id, rol: usuario.rol }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { nombre, email, password, organizacion, tipo_organizacion } = matchedData(req);

    // El primer usuario del sistema administra; el resto entra como editor
    const esPrimero = (await User.count({ paranoid: false })) === 0;

    // Transacción: usuario y perfil (1:1) se crean juntos o no se crea ninguno
    const usuario = await sequelize.transaction(async (transaction) => {
      const nuevo = await User.create(
        { nombre, email, password, rol: esPrimero ? 'admin' : 'editor' },
        { transaction }
      );
      await Profile.create({ organizacion, tipo_organizacion, user_id: nuevo.id }, { transaction });
      return nuevo;
    });

    const completo = await User.findByPk(usuario.id, { include: [PERFIL] });
    return res.status(201).json({ token: firmarToken(completo), usuario: completo });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
    }
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = matchedData(req);
    const usuario = await User.scope('conPassword').findOne({ where: { email } });

    // Mismo mensaje para email o contraseña: no revela qué cuentas existen
    if (!usuario || !(await usuario.validarPassword(password))) {
      return res.status(401).json({ message: 'Email o contraseña incorrectos' });
    }

    const completo = await User.findByPk(usuario.id, { include: [PERFIL] });
    return res.status(200).json({ token: firmarToken(completo), usuario: completo });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// GET /api/auth/me
export const me = async (req, res) => {
  try {
    const usuario = await User.findByPk(req.user.id, { include: [PERFIL] });
    return res.status(200).json(usuario);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
