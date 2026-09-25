import { matchedData } from 'express-validator';
import { Op, UniqueConstraintError } from 'sequelize';
import { sequelize, User, Profile } from '../models/index.js';

const ATRIBUTOS = ['id', 'nombre', 'email', 'rol', 'createdAt'];
const PERFIL = { model: Profile, as: 'perfil', attributes: ['organizacion', 'tipo_organizacion', 'moneda'] };

// GET /api/users  (solo admin)
export const getUsers = async (req, res) => {
  try {
    const usuarios = await User.findAll({ attributes: ATRIBUTOS, include: [PERFIL], order: [['nombre', 'ASC']] });
    return res.status(200).json(usuarios);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// GET /api/users/:id  (admin o el propio usuario)
export const getUserById = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    if (req.user.rol !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ message: 'Solo podés ver tu propio usuario' });
    }
    const usuario = await User.findByPk(id, { attributes: ATRIBUTOS, include: [PERFIL] });
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.status(200).json(usuario);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// PUT /api/users/:id  (admin o el propio usuario; solo admin cambia roles)
export const updateUser = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const cleanData = matchedData(req, { locations: ['body'] });

    const esAdmin = req.user.rol === 'admin';
    if (!esAdmin && req.user.id !== id) {
      return res.status(403).json({ message: 'Solo podés editar tu propio usuario' });
    }
    if (cleanData.rol && !esAdmin) {
      return res.status(403).json({ message: 'Solo un administrador puede cambiar roles' });
    }
    if (cleanData.rol && esAdmin && req.user.id === id && cleanData.rol !== 'admin') {
      return res.status(400).json({ message: 'No podés quitarte el rol de administrador a vos mismo' });
    }

    const usuario = await User.findByPk(id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (cleanData.email && cleanData.email !== usuario.email) {
      const duplicado = await User.findOne({ where: { email: cleanData.email, id: { [Op.ne]: id } }, paranoid: false });
      if (duplicado) return res.status(409).json({ message: 'Ese email ya lo usa otra cuenta' });
    }

    await usuario.update(cleanData);
    const actualizado = await User.findByPk(id, { attributes: ATRIBUTOS, include: [PERFIL] });
    return res.status(200).json(actualizado);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: 'Ese email ya lo usa otra cuenta' });
    }
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// DELETE /api/users/:id  (solo admin, baja lógica de usuario y perfil)
export const deleteUser = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    if (req.user.id === id) {
      return res.status(400).json({ message: 'No podés dar de baja tu propia cuenta' });
    }
    const usuario = await User.findByPk(id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    await sequelize.transaction(async (transaction) => {
      await Profile.destroy({ where: { user_id: id }, transaction });
      await User.destroy({ where: { id }, transaction });
    });
    // Sus fuentes y reportes se conservan: el historial de la organización no se pierde
    return res.status(200).json({ message: 'Usuario dado de baja correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
