import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';

// Notificaciones flotantes + confirmación antes de acciones destructivas
const FeedbackContext = createContext(null);
export const useFeedback = () => useContext(FeedbackContext);

let siguienteId = 1;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmacion, setConfirmacion] = useState(null);
  const resolver = useRef(null);

  const notificar = useCallback((mensaje, tipo = 'exito') => {
    const id = siguienteId++;
    setToasts((t) => [...t, { id, mensaje, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  // Uso: if (await confirmar('¿Eliminar?')) { ... }
  const confirmar = useCallback((mensaje, textoBoton = 'Eliminar') => new Promise((resolve) => {
    resolver.current = resolve;
    setConfirmacion({ mensaje, textoBoton });
  }), []);

  const cerrarConfirmacion = (respuesta) => {
    resolver.current?.(respuesta);
    setConfirmacion(null);
  };

  return (
    <FeedbackContext.Provider value={{ notificar, confirmar }}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`aviso aviso-${t.tipo}`} role={t.tipo === 'error' ? 'alert' : 'status'}>
            <i className={`bi ${t.tipo === 'error' ? 'bi-exclamation-circle' : 'bi-check2-circle'}`} />
            <span>{t.mensaje}</span>
            <button type="button" className="btn-close btn-sm" aria-label="Cerrar"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
          </div>
        ))}
      </div>

      <Modal
        show={!!confirmacion}
        title="Confirmar"
        size="sm"
        onClose={() => cerrarConfirmacion(false)}
        footer={(
          <>
            <button type="button" className="btn btn-link" onClick={() => cerrarConfirmacion(false)}>Cancelar</button>
            <button type="button" className="btn btn-peligro" onClick={() => cerrarConfirmacion(true)}>
              {confirmacion?.textoBoton}
            </button>
          </>
        )}
      >
        <p className="mb-0">{confirmacion?.mensaje}</p>
      </Modal>
    </FeedbackContext.Provider>
  );
}
