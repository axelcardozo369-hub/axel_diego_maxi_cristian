import { matchedData } from 'express-validator';
import { Op, UniqueConstraintError } from 'sequelize';
import { Category } from '../models/index.js';

const ATRIBUTOS = ['id', 'nombre', 'color'];

// GET /api/categories
export const getCategories = async (req, res) => {
  try {
    const categorias = await Category.findAll({ attributes: ATRIBUTOS, order: [['nombre', 'ASC']] });
    return res.status(200).json(categorias);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/categories
export const createCategory = async (req, res) => {
  try {
    const cleanData = matchedData(req);
    const categoria = await Category.create(cleanData);
    return res.status(201).json(categoria);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: 'Ya existe una categoría con ese nombre' });
    }
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// PUT /api/categories/:id
export const updateCategory = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const cleanData = matchedData(req, { locations: ['body'] });
    const categoria = await Category.findByPk(id);
    if (!categoria) return res.status(404).json({ message: 'Categoría no encontrada' });

    if (cleanData.nombre && cleanData.nombre !== categoria.nombre) {
      const duplicada = await Category.findOne({ where: { nombre: cleanData.nombre, id: { [Op.ne]: id } }, paranoid: false });
      if (duplicada) return res.status(409).json({ message: 'Ya existe una categoría con ese nombre' });
    }
    await categoria.update(cleanData);
    return res.status(200).json(categoria);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// DELETE /api/categories/:id  (baja lógica)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const categoria = await Category.findByPk(id);
    if (!categoria) return res.status(404).json({ message: 'Categoría no encontrada' });
    await Category.destroy({ where: { id } });
    return res.status(200).json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
