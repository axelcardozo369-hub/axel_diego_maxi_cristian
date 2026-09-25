import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Loading from './components/Loading.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Fuentes from './pages/Fuentes.jsx';
import Perfil from './pages/Perfil.jsx';
import Usuarios from './pages/Usuarios.jsx';
import IA from './pages/IA.jsx';

// Solo deja pasar a usuarios logueados (y con el rol pedido, si corresponde)
function Protegida({ children, roles }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Loading texto="Abriendo tu sesión..." />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { usuario } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protegida><AppLayout /></Protegida>}>
        <Route index element={<Dashboard />} />
        <Route path="fuentes" element={<Fuentes />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="ia" element={<IA />} />
        <Route path="usuarios" element={<Protegida roles={['admin']}><Usuarios /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
