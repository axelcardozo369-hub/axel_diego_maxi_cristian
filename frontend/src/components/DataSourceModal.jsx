import { useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Field from './Field.jsx';
import { useForm, reglas } from '../hooks/useForm.js';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { dataSourcesApi } from '../services/api.js';
import { TIPOS_FUENTE, tamano, tipoPorNombre } from '../utils/formato.js';

const tituloDesdeArchivo = (nombre) => nombre.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

// Alta: se arrastra CUALQUIER archivo (sin límite de tamaño) o se pega texto.
// El identificador lo genera el sistema y el título sale del nombre del archivo.
// Edición: solo título y categorías.
export default function DataSourceModal({ show, onClose, onSaved, fuente = null, categorias = [] }) {
  const { notificar } = useFeedback();
  const form = useForm({ titulo: '', texto: '' }, {
    titulo: (v) => (!v.trim() || v.trim().length >= 3 ? '' : 'Mínimo 3 caracteres'),
  });
  const [modo, setModo] = useState('archivo');
  const [archivo, setArchivo] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [progreso, setProgreso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const tituloEditado = useRef(false);
  const inputArchivo = useRef(null);

  useEffect(() => {
    if (!show) return;
    form.reset({ titulo: fuente?.titulo || '', texto: '' });
    setSeleccionadas(fuente ? fuente.categorias.map((c) => c.id) : []);
    setModo('archivo');
    setArchivo(null);
    setErrorArchivo('');
    setProgreso(null);
    tituloEditado.current = Boolean(fuente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, fuente]);

  const elegirArchivo = (elegido) => {
    if (!elegido) return;
    setArchivo(elegido);
    setErrorArchivo('');
    // El título se completa solo, salvo que la persona ya lo haya escrito
    if (!tituloEditado.current) form.setValue('titulo', tituloDesdeArchivo(elegido.name));
  };

  const alSoltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  };

  const cambiarTitulo = (e) => {
    tituloEditado.current = e.target.value.trim() !== '';
    form.handleChange(e);
  };

  const alternarCategoria = (id) => setSeleccionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.validarTodo()) return;
    if (!fuente && modo === 'archivo' && !archivo) { setErrorArchivo('Elegí o arrastrá un archivo'); return; }
    if (!fuente && modo === 'texto' && !form.values.texto.trim()) {
      form.aplicarErroresServidor([{ path: 'texto', msg: 'Pegá el contenido' }]);
      return;
    }

    setGuardando(true);
    try {
      const titulo = form.values.titulo.trim();
      if (fuente) {
        await dataSourcesApi.actualizar(fuente.id, { titulo, categorias: seleccionadas });
        notificar('Fuente actualizada');
      } else {
        const datos = modo === 'archivo'
          ? { archivo, titulo, categorias: seleccionadas }
          : { texto: form.values.texto, titulo, categorias: seleccionadas };
        const creada = await dataSourcesApi.crear(datos, setProgreso);
        notificar(`Fuente cargada (${creada.identificador}). La IA la está identificando.`);
      }
      onSaved();
    } catch (error) {
      const sueltos = form.aplicarErroresServidor(error.errors);
      notificar(sueltos[0] || error.message, 'error');
    } finally {
      setGuardando(false);
      setProgreso(null);
    }
  };

  const tipo = archivo ? TIPOS_FUENTE[tipoPorNombre(archivo.name, archivo.type)] : null;

  return (
    <Modal
      show={show}
      onClose={guardando ? () => {} : onClose}
      title={fuente ? 'Editar fuente de datos' : 'Cargar fuente de datos'}
      size="lg"
      as="form"
      onSubmit={guardar}
      footer={(
        <>
          <button type="button" className="btn btn-link" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando && <span className="spinner-border spinner-border-sm me-2" />}
            {guardando && progreso !== null ? `Subiendo ${progreso}%` : 'Guardar fuente'}
          </button>
        </>
      )}
    >
      {fuente ? (
        <p className="small text-secundario">Identificador: <span className="mono">{fuente.identificador}</span></p>
      ) : (
        <>
          <div className="filtros mb-3 d-inline-flex" role="tablist">
            <button type="button" role="tab" aria-selected={modo === 'archivo'} className={`filtro ${modo === 'archivo' ? 'activo' : ''}`} onClick={() => setModo('archivo')}>Subir archivo</button>
            <button type="button" role="tab" aria-selected={modo === 'texto'} className={`filtro ${modo === 'texto' ? 'activo' : ''}`} onClick={() => setModo('texto')}>Pegar texto</button>
          </div>

          {modo === 'archivo' ? (
            <div className="mb-3">
              <div
                className={`zona-archivo ${arrastrando ? 'arrastrando' : ''} ${errorArchivo ? 'con-error' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={alSoltar}
                onClick={() => inputArchivo.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputArchivo.current?.click(); } }}
                role="button"
                tabIndex={0}
                aria-label="Elegir archivo"
              >
                {archivo ? (
                  <div className="archivo-elegido">
                    <i className={`bi ${tipo.icono}`} aria-hidden="true" />
                    <div>
                      <p className="mb-0 fw-bold">{archivo.name}</p>
                      <p className="mb-0 small text-secundario">{tipo.texto} · {tamano(archivo.size)} · clic para cambiar</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                    <p className="mb-1 fw-bold">Arrastrá un archivo o hacé clic para elegirlo</p>
                    <p className="mb-0 small text-secundario">Planillas, JSON, PDF, Word, fotos, audios, videos o cualquier otro formato. Sin límite de tamaño.</p>
                  </>
                )}
              </div>
              <input ref={inputArchivo} type="file" className="visually-hidden" onChange={(e) => elegirArchivo(e.target.files?.[0])} tabIndex={-1} />
              {errorArchivo && <div className="invalid-feedback d-block">{errorArchivo}</div>}
              {progreso !== null && (
                <div className="progress mt-2" role="progressbar" aria-label="Progreso de la subida" aria-valuenow={progreso} aria-valuemin="0" aria-valuemax="100">
                  <div className="progress-bar" style={{ width: `${progreso}%` }} />
                </div>
              )}
            </div>
          ) : (
            <Field label="Contenido" form={form} name="texto" as="textarea" rows={7} className="mono"
              placeholder={'Pegá una planilla, un JSON o cualquier texto.\nfecha;socio;monto;estado\n01/09/2026;Ana Benítez;1.500;paga'} />
          )}
        </>
      )}

      <Field label="Título" form={form} name="titulo" onChange={cambiarTitulo}
        placeholder={modo === 'archivo' ? 'Se completa con el nombre del archivo' : 'Opcional'}
        help={fuente ? '' : 'Se toma del nombre del archivo. Podés cambiarlo.'} />

      <fieldset>
        <legend className="form-label">Categorías</legend>
        {categorias.length === 0 && <p className="small text-secundario mb-0">Todavía no hay categorías. Creá alguna en el panel de la derecha.</p>}
        <div className="d-flex flex-wrap gap-2">
          {categorias.map((c) => (
            <button key={c.id} type="button" onClick={() => alternarCategoria(c.id)}
              className={`chip ${seleccionadas.includes(c.id) ? 'chip-activo' : ''}`}
              style={{ '--chip-color': c.color }} aria-pressed={seleccionadas.includes(c.id)}>
              {seleccionadas.includes(c.id) && <i className="bi bi-check2 me-1" />}{c.nombre}
            </button>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}
