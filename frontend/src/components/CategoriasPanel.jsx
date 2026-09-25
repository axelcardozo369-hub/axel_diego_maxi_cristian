import { useState } from 'react';
import { categoriesApi } from '../services/api.js';
import { useFeedback } from '../context/FeedbackContext.jsx';

const COLORES = ['#3346A8', '#0F7B6C', '#B4540A', '#8E3B7A', '#5A6478'];

export default function CategoriasPanel({ categorias, onChange, editable }) {
  const { notificar, confirmar } = useFeedback();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORES[0]);
  const [error, setError] = useState('');

  const crear = async (e) => {
    e.preventDefault();
    if (nombre.trim().length < 2) { setError('Mínimo 2 caracteres'); return; }
    try {
      await categoriesApi.crear({ nombre: nombre.trim(), color });
      setNombre('');
      setError('');
      notificar('Categoría creada');
      onChange();
    } catch (err) {
      setError(err.errors?.[0]?.msg || err.message);
    }
  };

  const eliminar = async (c) => {
    if (!(await confirmar(`¿Eliminar la categoría "${c.nombre}"? Las fuentes no se borran.`))) return;
    try {
      await categoriesApi.eliminar(c.id);
      notificar('Categoría eliminada');
      onChange();
    } catch (err) {
      notificar(err.message, 'error');
    }
  };

  return (
    <section className="panel">
      <h2 className="h6">Categorías</h2>
      <ul className="lista-categorias">
        {categorias.map((c) => (
          <li key={c.id}>
            <span className="punto" style={{ background: c.color }} aria-hidden="true" />
            {c.nombre}
            {editable && (
              <button type="button" className="btn-icono ms-auto" aria-label={`Eliminar ${c.nombre}`} onClick={() => eliminar(c)}>
                <i className="bi bi-x-lg" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form onSubmit={crear} noValidate className="mt-3">
          <label className="form-label small" htmlFor="nuevaCategoria">Nueva categoría</label>
          <div className="input-group input-group-sm">
            <input id="nuevaCategoria" className={`form-control ${error ? 'is-invalid' : ''}`} value={nombre}
              onChange={(e) => { setNombre(e.target.value); if (error) setError(''); }} placeholder="Ej: Donaciones" />
            <button className="btn btn-primario" type="submit" aria-label="Agregar categoría"><i className="bi bi-plus-lg" /></button>
          </div>
          {error && <div className="invalid-feedback d-block">{error}</div>}
          <div className="d-flex gap-2 mt-2" role="radiogroup" aria-label="Color">
            {COLORES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c}
                className={`muestra-color ${color === c ? 'activa' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </form>
      )}
    </section>
  );
}
