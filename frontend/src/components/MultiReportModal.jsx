import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Field from './Field.jsx';
import ReporteView from './ReporteView.jsx';
import { useForm, reglas } from '../hooks/useForm.js';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { dataSourcesApi, reportsApi } from '../services/api.js';
import { TIPOS_FUENTE } from '../utils/formato.js';

const MODOS = [
  {
    valor: 'comparacion', icono: 'bi-arrow-left-right', titulo: 'Comparar',
    texto: 'Ver en qué se distinguen dos fuentes: registros, valores cambiados, duplicados, celdas vacías y totales.',
    ideas: ['¿En qué se distinguen estas fuentes?', '¿Qué registros cambiaron entre una versión y la otra?', '¿Qué limpieza se hizo sobre los datos?'],
  },
  {
    valor: 'consolidacion', icono: 'bi-union', titulo: 'Consolidar',
    texto: 'Unir varias fuentes (JSON, CSV, Excel) y armar un arqueo: ingresos, egresos y saldo por sucursal u otro grupo.',
    ideas: ['Hacé un arqueo de movimientos por sucursal', '¿Qué sucursal tiene el mayor saldo?', 'Consolidá las ventas de todas las fuentes'],
  },
  {
    valor: 'consulta', icono: 'bi-chat-square-text', titulo: 'Preguntar',
    texto: 'Hacer una pregunta libre que se responde buscando en todas las fuentes elegidas.',
    ideas: ['¿Cuánto se pagó a proveedores en total?', '¿Qué gastos se repiten en todas las sucursales?'],
  },
];

// Reportes sobre VARIAS fuentes. Paso 1: fuentes + qué hacer + pregunta.
// Paso 2: revisar el borrador y guardar (queda asociado a todas las fuentes).
export default function MultiReportModal({ show, onClose, onSaved, fuentesIniciales = [] }) {
  const { notificar } = useFeedback();
  const [fuentes, setFuentes] = useState([]);
  const [elegidas, setElegidas] = useState([]);
  const [modo, setModo] = useState('comparacion');
  const [errorFuentes, setErrorFuentes] = useState('');
  const [borrador, setBorrador] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const pregunta = useForm({ consulta: '' }, {
    consulta: (v) => {
      if (!v.trim()) return modo === 'consulta' ? 'Escribí qué querés saber' : '';
      return v.trim().length >= 5 ? '' : 'Mínimo 5 caracteres';
    },
  });
  const edicion = useForm({ titulo: '', resumen_ejecutivo: '', estado: 'borrador' }, {
    resumen_ejecutivo: reglas.largo(10, 10000, 'La respuesta debe tener al menos 10 caracteres'),
  });

  useEffect(() => {
    if (!show) return;
    dataSourcesApi.listar().then(setFuentes).catch((e) => notificar(e.message, 'error'));
    setElegidas(fuentesIniciales);
    setModo(fuentesIniciales.length > 2 ? 'consolidacion' : 'comparacion');
    setBorrador(null);
    setErrorFuentes('');
    pregunta.reset({ consulta: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const disponibles = fuentes.filter((f) => ['listo', 'sin_ia'].includes(f.estado_ia));
  const modoActual = MODOS.find((m) => m.valor === modo);

  const alternar = (id) => {
    setErrorFuentes('');
    setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  };

  const validarFuentes = () => {
    if (modo === 'comparacion' && elegidas.length !== 2) return 'Para comparar elegí exactamente 2 fuentes (la primera que elijas es la "original").';
    if (elegidas.length < 2) return 'Elegí al menos 2 fuentes.';
    if (elegidas.length > 10) return 'Elegí como máximo 10 fuentes.';
    return '';
  };

  const generar = async (e) => {
    e?.preventDefault();
    const error = validarFuentes();
    setErrorFuentes(error);
    if (!pregunta.validarTodo() || error) return;
    setGenerando(true);
    try {
      const resultado = await reportsApi.generarMultiple({ data_source_ids: elegidas, modo, consulta: pregunta.values.consulta.trim() });
      setBorrador(resultado);
      edicion.reset({ titulo: resultado.titulo || '', resumen_ejecutivo: resultado.resumen_ejecutivo, estado: 'borrador' });
    } catch (err) {
      const sueltos = pregunta.aplicarErroresServidor(err.errors);
      const deFuentes = err.errors?.find((x) => ['data_source_ids', 'modo'].includes(x.path));
      if (deFuentes) setErrorFuentes(deFuentes.msg);
      notificar(deFuentes?.msg || sueltos[0] || err.message, 'error');
    } finally {
      setGenerando(false);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!edicion.validarTodo()) return;
    setGuardando(true);
    try {
      const { data_source_id, data_source_ids, consulta, metricas_clave, origen, modelo_ia } = borrador;
      await reportsApi.crear({
        data_source_id, data_source_ids, consulta, metricas_clave, origen, modelo_ia,
        titulo: edicion.values.titulo.trim(),
        resumen_ejecutivo: edicion.values.resumen_ejecutivo.trim(),
        estado: edicion.values.estado,
      });
      notificar('Reporte guardado. Podés descargarlo en PDF desde el Tablero.');
      onSaved();
    } catch (err) {
      const sueltos = edicion.aplicarErroresServidor(err.errors);
      notificar(sueltos[0] || err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Paso 1 ----------
  if (!borrador) {
    return (
      <Modal show={show} onClose={generando ? () => {} : onClose} title="Reporte con varias fuentes" size="lg" as="form" onSubmit={generar}
        footer={(
          <>
            <button type="button" className="btn btn-link" onClick={onClose} disabled={generando}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={generando}>
              {generando ? <><span className="spinner-border spinner-border-sm me-2" />Analizando {elegidas.length} fuentes…</> : <><i className="bi bi-stars me-1" />Generar reporte</>}
            </button>
          </>
        )}
      >
        <p className="form-label mb-2">1. ¿Qué querés hacer?</p>
        <div className="modos mb-3" role="radiogroup" aria-label="Tipo de reporte">
          {MODOS.map((m) => (
            <button key={m.valor} type="button" role="radio" aria-checked={modo === m.valor} disabled={generando}
              className={`modo ${modo === m.valor ? 'activo' : ''}`} onClick={() => { setModo(m.valor); setErrorFuentes(''); }}>
              <i className={`bi ${m.icono}`} aria-hidden="true" />
              <span className="modo-titulo">{m.titulo}</span>
              <span className="modo-texto">{m.texto}</span>
            </button>
          ))}
        </div>

        <p className="form-label mb-1">2. Elegí las fuentes {modo === 'comparacion' ? '(exactamente 2)' : '(2 o más)'}</p>
        {modo === 'comparacion' && <p className="small text-secundario mb-2">La primera que elijas se toma como la versión original y la segunda como la nueva.</p>}
        <div className={`selector-fuentes ${errorFuentes ? 'con-error' : ''}`}>
          {disponibles.length === 0 && <p className="small text-secundario m-2">No hay fuentes listas todavía.</p>}
          {disponibles.map((f) => {
            const orden = elegidas.indexOf(f.id);
            return (
              <label key={f.id} className={`opcion-fuente ${orden >= 0 ? 'elegida' : ''}`}>
                <input type="checkbox" className="form-check-input" checked={orden >= 0} disabled={generando} onChange={() => alternar(f.id)} />
                <i className={`bi ${TIPOS_FUENTE[f.tipo_fuente]?.icono}`} aria-hidden="true" />
                <span className="flex-grow-1">
                  <span className="d-block fw-bold">{f.titulo}</span>
                  <span className="d-block small text-secundario">{TIPOS_FUENTE[f.tipo_fuente]?.texto} · <span className="mono">{f.identificador}</span></span>
                </span>
                {orden >= 0 && <span className="orden" aria-label={`Elegida en el lugar ${orden + 1}`}>{orden + 1}</span>}
              </label>
            );
          })}
        </div>
        {errorFuentes && <div className="invalid-feedback d-block">{errorFuentes}</div>}

        <div className="mt-3">
          <Field label={`3. ${modo === 'consulta' ? '¿Qué querés saber?' : '¿Algo en particular? (opcional)'}`} form={pregunta} name="consulta" as="textarea" rows={2} disabled={generando}
            placeholder={modoActual.ideas[0]} />
          <div className="d-flex flex-wrap gap-2">
            {modoActual.ideas.map((idea) => (
              <button key={idea} type="button" className="chip" disabled={generando} onClick={() => pregunta.setValue('consulta', idea)}>{idea}</button>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  // ---------- Paso 2 ----------
  return (
    <Modal show={show} onClose={guardando ? () => {} : onClose} title="Revisá el reporte" size="xl" as="form" onSubmit={guardar}
      footer={(
        <>
          <button type="button" className="btn btn-link me-auto" onClick={() => setBorrador(null)} disabled={guardando}><i className="bi bi-arrow-left me-1" />Cambiar fuentes o pregunta</button>
          <button type="button" className="btn btn-link" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando && <span className="spinner-border spinner-border-sm me-2" />}Guardar reporte
          </button>
        </>
      )}
    >
      <p className="consulta"><i className="bi bi-chat-square-text me-2" />{borrador.consulta}</p>
      <p className={`motor-reporte ${borrador.origen === 'ia' ? 'con-ia' : ''}`}>
        <i className={`bi ${borrador.origen === 'ia' ? 'bi-stars' : 'bi-cpu'} me-2`} aria-hidden="true" />
        {borrador.origen === 'ia'
          ? <>Redactó la IA (<b>{borrador.modelo_ia}</b>). Las tablas y cifras las calculó el sistema de forma exacta.</>
          : <>Lo armó el <b>motor local</b> con cifras exactas.</>}
      </p>
      {borrador.aviso && <p className="limitaciones">{borrador.aviso}</p>}

      <div className="row">
        <div className="col-lg-8"><Field label="Título" form={edicion} name="titulo" /></div>
        <div className="col-lg-4">
          <Field label="Estado" form={edicion} name="estado" as="select">
            <option value="borrador">Borrador</option>
            <option value="publicado">Publicado</option>
            <option value="archivado">Archivado</option>
          </Field>
        </div>
      </div>
      <Field label="Respuesta" form={edicion} name="resumen_ejecutivo" as="textarea" rows={4}
        help="Podés corregir o agregar lo que sabés y los datos no dicen." />
      <ReporteView metricas={borrador.metricas_clave} />
    </Modal>
  );
}
