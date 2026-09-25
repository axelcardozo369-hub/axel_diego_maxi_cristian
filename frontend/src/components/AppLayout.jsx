import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { iaApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLES = { admin: 'Administración', editor: 'Edición', lector: 'Solo lectura' };

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const [ia, setIa] = useState(null);

  useEffect(() => { iaApi.estado().then(setIa).catch(() => setIa(null)); }, []);

  return (
    <div className="app">
      <aside className="barra">
        <div className="marca">
          <span className="marca-logo" aria-hidden="true" />
          <div>
            <p className="marca-nombre">InfoHub</p>
            <p className="marca-org">{usuario.perfil?.organizacion || 'Tu organización'}</p>
          </div>
        </div>

        <nav className="navegacion" aria-label="Secciones">
          <NavLink to="/" end><i className="bi bi-grid-1x2" />Tablero</NavLink>
          <NavLink to="/fuentes"><i className="bi bi-collection" />Fuentes de datos</NavLink>
          {usuario.rol === 'admin' && <NavLink to="/usuarios"><i className="bi bi-people" />Usuarios</NavLink>}
          <NavLink to="/ia"><i className="bi bi-stars" />Cómo funciona la IA</NavLink>
          <NavLink to="/perfil"><i className="bi bi-person-gear" />Perfil</NavLink>
        </nav>

        {ia && (
          <NavLink to="/ia" className={`estado-ia-barra ${ia.configurada ? 'activa' : ''}`} title="Ver cómo funciona la IA">
            <i className={`bi ${ia.configurada ? 'bi-stars' : 'bi-cpu'} me-2`} aria-hidden="true" />
            {ia.configurada ? `IA: ${ia.proveedor}` : 'Motor local (sin IA)'}
          </NavLink>
        )}

        <div className="sesion">
          <p className="mb-0 fw-bold">{usuario.nombre}</p>
          <p className="small mb-2">{ROLES[usuario.rol]}</p>
          <button type="button" className="btn btn-sm btn-salir" onClick={logout}>
            <i className="bi bi-box-arrow-left me-1" />Salir
          </button>
        </div>
      </aside>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
