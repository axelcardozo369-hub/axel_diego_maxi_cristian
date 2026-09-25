import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, tokenStorage } from '../services/api.js';
import { useFeedback } from './FeedbackContext.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const { notificar } = useFeedback();

  const guardarSesion = ({ token, usuario: u }) => {
    tokenStorage.set(token);
    setUsuario(u);
  };

  const login = async (datos) => guardarSesion(await authApi.login(datos));
  const register = async (datos) => guardarSesion(await authApi.register(datos));

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUsuario(null);
  }, []);

  const refrescar = useCallback(async () => setUsuario(await authApi.me()), []);

  // Al abrir la app: si hay token guardado, recuperamos al usuario
  useEffect(() => {
    if (!tokenStorage.get()) { setCargando(false); return; }
    refrescar().catch(logout).finally(() => setCargando(false));
  }, [refrescar, logout]);

  useEffect(() => {
    const alExpirar = () => {
      logout();
      notificar('Tu sesión expiró. Volvé a ingresar.', 'error');
    };
    window.addEventListener('sesion:expirada', alExpirar);
    return () => window.removeEventListener('sesion:expirada', alExpirar);
  }, [logout, notificar]);

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, register, logout, refrescar }}>
      {children}
    </AuthContext.Provider>
  );
}
