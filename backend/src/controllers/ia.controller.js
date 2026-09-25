import { estadoIA, probarProveedores } from '../services/ia/index.js';

// GET /api/ia/estado — proveedores configurados, pausas por cuota y uso del día
export const getEstadoIA = (req, res) => {
  try {
    return res.status(200).json(estadoIA());
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// POST /api/ia/probar — (admin) un pedido mínimo a cada proveedor para
// saber si la clave, el modelo y la cuota funcionan AHORA
export const probarIA = async (req, res) => {
  try {
    const resultados = await probarProveedores();
    return res.status(200).json({ resultados, estado: estadoIA() });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
