import { useEffect, useRef } from 'react';

// Modal controlado por estado de React (sin depender del JS de Bootstrap)
export default function Modal({ show, title, onClose, children, footer, size = '', as: Contenedor = 'div', onSubmit }) {
  const dialogo = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    const alPresionar = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', alPresionar);
    document.body.classList.add('modal-open');
    dialogo.current?.querySelector('input, textarea, select, button:not(.btn-close)')?.focus();
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.classList.remove('modal-open');
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size ? `modal-${size}` : ''}`} ref={dialogo}>
          <Contenedor className="modal-content" onSubmit={onSubmit} noValidate={Contenedor === 'form' ? true : undefined}>
            <div className="modal-header">
              <h2 className="modal-title h5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </Contenedor>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
