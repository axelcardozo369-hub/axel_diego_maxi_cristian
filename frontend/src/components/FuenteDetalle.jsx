import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Loading from './Loading.jsx';
import EstadoIA from './EstadoIA.jsx';
import { dataSourcesApi } from '../services/api.js';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { TIPOS_FUENTE, fecha, tamano } from '../utils/formato.js';

const MAX_VISTA = 4000;

// Qué entendió la IA de la fuente y qué contenido se pudo extraer
export default function FuenteDetalle({ id, onClose, onPreguntar }) {
  const { notificar } = useFeedback();
  const [fuente, setFuente] = useState(null);

  useEffect(() => {
    if (!id) { setFuente(null); return; }
    dataSourcesApi.obtener(id).then(setFuente).catch((e) => { notificar(e.message, 'error'); onClose(); });
  }, [id, notificar, onClose]);

  const descargar = () => dataSourcesApi.descargar(fuente.id, fuente.archivo_nombre).catch((e) => notificar(e.message, 'error'));
  const contenido = fuente?.contenido_crudo || '';

  return (
    <Modal show={!!id} onClose={onClose} title={fuente?.titulo || 'Fuente de datos'} size="lg"
      footer={fuente && (
        <>
          {fuente.archivo_nombre && <button type="button" className="btn btn-link me-auto" onClick={descargar}><i className="bi bi-download me-1" />Descargar original</button>}
          {onPreguntar && ['listo', 'sin_ia'].includes(fuente.estado_ia) && (
            <button type="button" className="btn btn-primario" onClick={() => onPreguntar(fuente.id)}><i className="bi bi-chat-square-text me-1" />Preguntarle a esta fuente</button>
          )}
        </>
      )}
    >
      {!fuente ? <Loading /> : (
        <>
          <div className="d-flex flex-wrap gap-3 align-items-center mb-3 small">
            <span><i className={`bi ${TIPOS_FUENTE[fuente.tipo_fuente]?.icono} me-1`} />{TIPOS_FUENTE[fuente.tipo_fuente]?.texto}</span>
            <span className="mono">{fuente.identificador}</span>
            {fuente.archivo_nombre && <span>{fuente.archivo_nombre} · {tamano(fuente.tamano_bytes)}</span>}
            <span>Cargada el {fecha(fuente.createdAt)} por {fuente.autor?.nombre}</span>
            <EstadoIA fuente={fuente} />
          </div>

          {fuente.descripcion_ia && (
            <section className="bloque">
              <h3 className="bloque-titulo">
                <i className="bi bi-stars me-2" />{fuente.metadata?.tipo_contenido ? `Es: ${fuente.metadata.tipo_contenido}` : 'Qué contiene'}
              </h3>
              <p className="mb-0">{fuente.descripcion_ia}</p>
            </section>
          )}
          {fuente.error_ia && <p className="limitaciones"><i className="bi bi-exclamation-triangle me-2" />{fuente.error_ia}</p>}

          {fuente.sugerencias?.length > 0 && (
            <section className="bloque">
              <h3 className="bloque-titulo"><i className="bi bi-question-circle me-2" />Preguntas que podés hacerle</h3>
              <ul>{fuente.sugerencias.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>
          )}

          {contenido && (
            <section className="bloque">
              <h3 className="bloque-titulo"><i className="bi bi-body-text me-2" />Contenido {['pdf', 'imagen', 'audio', 'video'].includes(fuente.tipo_fuente) ? 'extraído por la IA' : ''}</h3>
              <pre className="contenido-crudo">{contenido.slice(0, MAX_VISTA)}{contenido.length > MAX_VISTA ? `\n\n… (${(contenido.length - MAX_VISTA).toLocaleString('es-AR')} caracteres más)` : ''}</pre>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
