import { matchedData } from 'express-validator';
import { Profile } from '../models/index.js';

const ATRIBUTOS = ['id', 'organizacion', 'tipo_organizacion', 'moneda', 'user_id', 'updatedAt'];

// GET /api/profile  (perfil del usuario logueado)
export const getMiPerfil = async (req, res) => {
  try {
    const perfil = await Profile.findOne({ where: { user_id: req.user.id }, attributes: ATRIBUTOS });
    if (!perfil) return res.status(404).json({ message: 'Perfil no encontrado' });
    return res.status(200).json(perfil);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// PUT /api/profile
export const updateMiPerfil = async (req, res) => {
  try {
    const cleanData = matchedData(req);
    const perfil = await Profile.findOne({ where: { user_id: req.user.id } });
    if (!perfil) return res.status(404).json({ message: 'Perfil no encontrado' });
    await perfil.update(cleanData);
    return res.status(200).json(perfil);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
