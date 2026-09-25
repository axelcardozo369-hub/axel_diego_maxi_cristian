import { useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Field from './Field.jsx';
import { useForm } from '../hooks/useForm.js';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { dataSourcesApi } from '../services/api.js';
import { TIPOS_FUENTE, tamano, tipoPorNombre } from '../utils/formato.js';

const tituloDesdeArchivo = (nombre) => nombre.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

// Alta: se arrastran UNO o VARIOS archivos (cualquier formato, sin límite) o se pega texto.
// El identificador lo genera el sistema y el título sale del nombre de cada archivo.
// Edición: solo título y categorías.
export default function DataSourceModal({ show, onClose, onSaved, fuente = null, categorias = [] }) {
  const { notificar } = useFeedback();
  const form = useForm({ titulo: '', texto: '' }, {
    titulo: (v) => (!v.trim() || v.trim().length >= 3 ? '' : 'Mínimo 3 caracteres'),
  });
  const [modo, setModo] = useState('archivo');
  // Cada archivo: { archivo, titulo, estado: 'espera'|'subiendo'|'listo'|'error', progreso, error }
  const [archivos, setArchivos] = useState([]);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [progreso, setProgreso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const tituloEditado = useRef(false);
  const inputArchivo = useRef(null);

  const varios = archivos.length > 1;

  useEffect(() => {
    if (!show) return;
    form.reset({ titulo: fuente?.titulo || '', texto: '' });
    setSeleccionadas(fuente ? fuente.categorias.map((c) => c.id) : []);
    setModo('archivo');
    setArchivos([]);
    setErrorArchivo('');
    setProgreso(null);
    tituloEditado.current = Boolean(fuente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, fuente]);

  const agregarArchivos = (lista) => {
    const nuevos = [...(lista || [])].map((archivo) => ({ archivo, titulo: tituloDesdeArchivo(archivo.name), estado: 'espera', progreso: 0, error: '' }));
    if (!nuevos.length) return;
    setErrorArchivo('');
    setArchivos((previos) => {
      // Se evitan duplicados (mismo nombre y tamaño)
      const existentes = new Set(previos.map((a) => `${a.archivo.name}|${a.archivo.size}`));
      const todos = [...previos.filter((a) => a.estado !== 'listo'), ...nuevos.filter((n) => !existentes.has(`${n.archivo.name}|${n.archivo.size}`))];
      // Con un solo archivo, el título se completa solo (como siempre), salvo que ya lo hayan escrito
      if (todos.length === 1 && !tituloEditado.current) form.setValue('titulo', todos[0].titulo);
      return todos;
    });
  };

  const quitarArchivo = (i) => setArchivos((a) => a.filter((_, j) => j !== i));
  const cambiarTituloDe = (i, titulo) => setArchivos((a) => a.map((x, j) => (j === i ? { ...x, titulo } : x)));

  const alSoltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    agregarArchivos(e.dataTransfer.files);
  };

  const cambiarTitulo = (e) => {
    tituloEditado.current = e.target.value.trim() !== '';
    form.handleChange(e);
  };

  const alternarCategoria = (id) => setSeleccionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Sube varios archivos de a uno: si uno falla, los demás siguen
  const subirVarios = async () => {
    const pendientes = archivos.map((a, i) => ({ ...a, i })).filter((a) => a.estado !== 'listo');
    const invalido = pendientes.find((a) => a.titulo.trim().length < 3);
    if (invalido) { notificar(`El título de "${invalido.archivo.name}" debe tener al menos 3 caracteres`, 'error'); return; }

    let ok = 0;
    for (const a of pendientes) {
      setArchivos((lista) => lista.map((x, j) => (j === a.i ? { ...x, estado: 'subiendo', progreso: 0, error: '' } : x)));
      try {
        await dataSourcesApi.crear(
          { archivo: a.archivo, titulo: a.titulo.trim(), categorias: seleccionadas },
          (p) => setArchivos((lista) => lista.map((x, j) => (j === a.i ? { ...x, progreso: p } : x)))
        );
        ok += 1;
        setArchivos((lista) => lista.map((x, j) => (j === a.i ? { ...x, estado: 'listo', progreso: 100 } : x)));
      } catch (error) {
        const detalle = error.errors?.[0]?.msg || error.message;
        setArchivos((lista) => lista.map((x, j) => (j === a.i ? { ...x, estado: 'error', error: detalle } : x)));
      }
    }
    const fallaron = pendientes.length - ok;
    if (fallaron === 0) {
      notificar(`Se cargaron ${ok} fuentes. La IA las está identificando.`);
      onSaved();
    } else {
      notificar(`Se cargaron ${ok} de ${pendientes.length}. Revisá los que fallaron y volvé a intentar.`, 'error');
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!fuente && modo === 'archivo' && varios) {
      setGuardando(true);
      try { await subirVarios(); } finally { setGuardando(false); }
      return;
    }
    if (!form.validarTodo()) return;
    if (!fuente && modo === 'archivo' && !archivos.length) { setErrorArchivo('Elegí o arrastrá uno o más archivos'); return; }
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
          ? { archivo: archivos[0].archivo, titulo, categorias: seleccionadas }
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

  const primero = archivos[0];
  const tipo = primero ? TIPOS_FUENTE[tipoPorNombre(primero.archivo.name, primero.archivo.type)] : null;
  const pendientes = archivos.filter((a) => a.estado !== 'listo').length;
  const textoBoton = () => {
    if (guardando && varios) return `Subiendo ${archivos.filter((a) => a.estado === 'listo').length + 1} de ${archivos.length}…`;
    if (guardando && progreso !== null) return `Subiendo ${progreso}%`;
    if (varios) return `Cargar ${pendientes} fuentes`;
    return 'Guardar fuente';
  };

  return (
    <Modal
      show={show}
      onClose={guardando ? () => {} : onClose}
      title={fuente ? 'Editar fuente de datos' : 'Cargar fuentes de datos'}
      size="lg"
      as="form"
      onSubmit={guardar}
      footer={(
        <>
          <button type="button" className="btn btn-link" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando || (varios && pendientes === 0)}>
            {guardando && <span className="spinner-border spinner-border-sm me-2" />}
            {textoBoton()}
          </button>
        </>
      )}
    >
      {fuente ? (
        <p className="small text-secundario">Identificador: <span className="mono">{fuente.identificador}</span></p>
      ) : (
        <>
          <div className="filtros mb-3 d-inline-flex" role="tablist">
            <button type="button" role="tab" aria-selected={modo === 'archivo'} className={`filtro ${modo === 'archivo' ? 'activo' : ''}`} onClick={() => setModo('archivo')}>Subir archivos</button>
            <button type="button" role="tab" aria-selected={modo === 'texto'} className={`filtro ${modo === 'texto' ? 'activo' : ''}`} onClick={() => setModo('texto')}>Pegar texto</button>
          </div>

          {modo === 'archivo' ? (
            <div className="mb-3">
              <div
                className={`zona-archivo ${arrastrando ? 'arrastrando' : ''} ${errorArchivo ? 'con-error' : ''} ${archivos.length ? 'compacta' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={alSoltar}
                onClick={() => !guardando && inputArchivo.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputArchivo.current?.click(); } }}
                role="button"
                tabIndex={0}
                aria-label="Elegir archivos"
              >
                {archivos.length === 1 ? (
                  <div className="archivo-elegido">
                    <i className={`bi ${tipo.icono}`} aria-hidden="true" />
                    <div>
                      <p className="mb-0 fw-bold">{primero.archivo.name}</p>
                      <p className="mb-0 small text-secundario">{tipo.texto} · {tamano(primero.archivo.size)} · clic o arrastrá para sumar más archivos</p>
                    </div>
                  </div>
                ) : archivos.length > 1 ? (
                  <p className="mb-0 small"><i className="bi bi-plus-circle me-1" />Hacé clic o arrastrá para sumar más archivos</p>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                    <p className="mb-1 fw-bold">Arrastrá uno o varios archivos, o hacé clic para elegirlos</p>
                    <p className="mb-0 small text-secundario">Planillas, JSON, PDF, Word, fotos, audios, videos o cualquier otro formato. Sin límite de tamaño.</p>
                  </>
                )}
              </div>
              <input ref={inputArchivo} type="file" multiple className="visually-hidden" tabIndex={-1}
                onChange={(e) => { agregarArchivos(e.target.files); e.target.value = ''; }} />
              {errorArchivo && <div className="invalid-feedback d-block">{errorArchivo}</div>}
              {progreso !== null && !varios && (
                <div className="progress mt-2" role="progressbar" aria-label="Progreso de la subida" aria-valuenow={progreso} aria-valuemin="0" aria-valuemax="100">
                  <div className="progress-bar" style={{ width: `${progreso}%` }} />
                </div>
              )}

              {varios && (
                <ul className="lista-archivos">
                  {archivos.map((a, i) => {
                    const t = TIPOS_FUENTE[tipoPorNombre(a.archivo.name, a.archivo.type)];
                    return (
                      <li key={`${a.archivo.name}-${a.archivo.size}`} className={`archivo-${a.estado}`}>
                        <i className={`bi ${t.icono}`} aria-hidden="true" />
                        <div className="flex-grow-1">
                          <label className="visually-hidden" htmlFor={`titulo-${i}`}>Título de {a.archivo.name}</label>
                          <input id={`titulo-${i}`} className="form-control form-control-sm" value={a.titulo}
                            disabled={guardando || a.estado === 'listo'} onChange={(e) => cambiarTituloDe(i, e.target.value)} />
                          <p className="small text-secundario mb-0">{a.archivo.name} · {t.texto} · {tamano(a.archivo.size)}</p>
                          {a.estado === 'subiendo' && (
                            <div className="progress mt-1" style={{ height: 5 }} role="progressbar" aria-valuenow={a.progreso} aria-valuemin="0" aria-valuemax="100">
                              <div className="progress-bar" style={{ width: `${a.progreso}%` }} />
                            </div>
                          )}
                          {a.estado === 'error' && <p className="small texto-peligro mb-0">{a.error}</p>}
                        </div>
                        {a.estado === 'listo' && <i className="bi bi-check-circle-fill text-success" aria-label="Cargado" />}
                        {['espera', 'error'].includes(a.estado) && !guardando && (
                          <button type="button" className="btn-icono" aria-label={`Quitar ${a.archivo.name}`} onClick={() => quitarArchivo(i)}><i className="bi bi-x-lg" /></button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <Field label="Contenido" form={form} name="texto" as="textarea" rows={7} className="mono"
              placeholder={'Pegá una planilla, un JSON o cualquier texto.\nfecha;socio;monto;estado\n01/09/2026;Ana Benítez;1.500;paga'} />
          )}
        </>
      )}

      {!varios && (
        <Field label="Título" form={form} name="titulo" onChange={cambiarTitulo}
          placeholder={modo === 'archivo' ? 'Se completa con el nombre del archivo' : 'Opcional'}
          help={fuente ? '' : 'Se toma del nombre del archivo. Podés cambiarlo.'} />
      )}

      <fieldset>
        <legend className="form-label">Categorías{varios ? ' (para todas)' : ''}</legend>
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
