import { useCallback, useEffect, useState } from 'react';
import { usersApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const { notificar, confirmar } = useFeedback();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setUsuarios(await usersApi.listar());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarRol = async (u, rol) => {
    try {
      await usersApi.actualizar(u.id, { rol });
      notificar(`${u.nombre} ahora tiene rol ${rol}`);
      cargar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  };

  const eliminar = async (u) => {
    if (!(await confirmar(`¿Dar de baja a ${u.nombre}? Sus fuentes y reportes se conservan.`, 'Dar de baja'))) return;
    try {
      await usersApi.eliminar(u.id);
      notificar('Usuario dado de baja');
      cargar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  };

  return (
    <>
      <header className="encabezado">
        <div>
          <h1 className="titulo-pagina">Usuarios</h1>
          <p className="text-secundario mb-0">Quién carga, quién edita y quién solo consulta.</p>
        </div>
      </header>
      {cargando ? <Loading /> : error ? <EmptyState icono="bi-wifi-off" titulo="No se pudo cargar" texto={error} /> : (
        <div className="tabla-contenedor table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Nombre</th><th>Email</th><th>Organización</th><th>Rol</th><th className="text-end">Acciones</th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="fw-bold">{u.nombre}{u.id === yo.id && <span className="small text-secundario"> (vos)</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.perfil?.organizacion || '—'}</td>
                  <td>
                    <select className="form-select form-select-sm w-auto" aria-label={`Rol de ${u.nombre}`} value={u.rol}
                      disabled={u.id === yo.id} onChange={(e) => cambiarRol(u, e.target.value)}>
                      <option value="admin">Administración</option>
                      <option value="editor">Edición</option>
                      <option value="lector">Solo lectura</option>
                    </select>
                  </td>
                  <td className="text-end">
                    {u.id !== yo.id && <button type="button" className="btn-icono" aria-label={`Dar de baja a ${u.nombre}`} onClick={() => eliminar(u)}><i className="bi bi-trash" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
