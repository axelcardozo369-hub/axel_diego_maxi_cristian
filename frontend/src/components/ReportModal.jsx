import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Field from './Field.jsx';
import ReporteView from './ReporteView.jsx';
import { useForm, reglas } from '../hooks/useForm.js';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { dataSourcesApi, reportsApi } from '../services/api.js';
import { TIPOS_FUENTE } from '../utils/formato.js';

const SUGERENCIAS_GENERALES = [
  '¿Cuáles son los datos más importantes y qué decisión me ayudan a tomar?',
  '¿Qué problemas o datos faltantes hay que corregir?',
];

// Reportes A PEDIDO: la persona elige la fuente y escribe qué quiere saber.
// La IA devuelve un borrador (indicadores, hallazgos, recomendaciones, tabla)
// que se revisa y recién ahí se guarda.
export default function ReportModal({ show, onClose, onSaved, reporte = null, fuenteInicial = '' }) {
  const { notificar } = useFeedback();
  const [fuentes, setFuentes] = useState([]);
  const [borrador, setBorrador] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const pregunta = useForm({ data_source_id: '', consulta: '' }, {
    data_source_id: reglas.requerido('Elegí la fuente de datos'),
    consulta: reglas.largo(5, 1000, 'Contá qué querés saber (mínimo 5 caracteres)'),
  });
  const edicion = useForm({ titulo: '', resumen_ejecutivo: '', estado: 'borrador' }, {
    resumen_ejecutivo: reglas.largo(10, 10000, 'El resumen debe tener al menos 10 caracteres'),
  });

  useEffect(() => {
    if (!show) return;
    dataSourcesApi.listar().then(setFuentes).catch((e) => notificar(e.message, 'error'));
    if (reporte) {
      setBorrador({ ...reporte });
      edicion.reset({ titulo: reporte.titulo || '', resumen_ejecutivo: reporte.resumen_ejecutivo, estado: reporte.estado });
    } else {
      setBorrador(null);
      pregunta.reset({ data_source_id: fuenteInicial ? String(fuenteInicial) : '', consulta: '' });
      edicion.reset({ titulo: '', resumen_ejecutivo: '', estado: 'borrador' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reporte, fuenteInicial]);

  const fuenteElegida = fuentes.find((f) => String(f.id) === String(pregunta.values.data_source_id));
  const disponibles = fuentes.filter((f) => ['listo', 'sin_ia'].includes(f.estado_ia));
  const sugerencias = [...(fuenteElegida?.sugerencias || []), ...SUGERENCIAS_GENERALES].slice(0, 5);

  const generar = async (e) => {
    e?.preventDefault();
    if (!pregunta.validarTodo()) return;
    setGenerando(true);
    try {
      const resultado = await reportsApi.generar({
        data_source_id: Number(pregunta.values.data_source_id),
        consulta: pregunta.values.consulta.trim(),
      });
      setBorrador(resultado);
      edicion.reset({ titulo: resultado.titulo || '', resumen_ejecutivo: resultado.resumen_ejecutivo, estado: 'borrador' });
    } catch (error) {
      const sueltos = pregunta.aplicarErroresServidor(error.errors);
      notificar(sueltos[0] || error.message, 'error');
    } finally {
      setGenerando(false);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!edicion.validarTodo()) return;
    setGuardando(true);
    try {
      const cambios = {
        titulo: edicion.values.titulo.trim(),
        resumen_ejecutivo: edicion.values.resumen_ejecutivo.trim(),
        estado: edicion.values.estado,
      };
      if (reporte) {
        await reportsApi.actualizar(reporte.id, cambios);
        notificar('Reporte actualizado');
      } else {
        const { data_source_id, consulta, metricas_clave, origen, modelo_ia } = borrador;
        await reportsApi.crear({ data_source_id, consulta, metricas_clave, origen, modelo_ia, ...cambios });
        notificar('Reporte guardado');
      }
      onSaved();
    } catch (error) {
      const sueltos = edicion.aplicarErroresServidor(error.errors);
      notificar(sueltos[0] || error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Paso 1: la pregunta ----------
  if (!borrador) {
    return (
      <Modal show={show} onClose={generando ? () => {} : onClose} title="Nuevo reporte" size="lg" as="form" onSubmit={generar}
        footer={(
          <>
            <button type="button" className="btn btn-link" onClick={onClose} disabled={generando}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={generando}>
              {generando ? <><span className="spinner-border spinner-border-sm me-2" />Analizando la fuente…</> : <><i className="bi bi-stars me-1" />Generar reporte</>}
            </button>
          </>
        )}
      >
        <Field label="¿Sobre qué fuente?" form={pregunta} name="data_source_id" as="select" disabled={generando}>
          <option value="">Elegí una fuente</option>
          {disponibles.map((f) => <option key={f.id} value={f.id}>{TIPOS_FUENTE[f.tipo_fuente]?.texto} · {f.titulo}</option>)}
        </Field>
        {fuentes.length > disponibles.length && (
          <p className="small text-secundario mt-n2">Las fuentes que todavía se están identificando aparecen cuando terminan.</p>
        )}
        {fuenteElegida?.descripcion_ia && <p className="descripcion-fuente"><i className="bi bi-stars me-2" />{fuenteElegida.descripcion_ia}</p>}

        <Field label="¿Qué querés saber?" form={pregunta} name="consulta" as="textarea" rows={3} disabled={generando}
          placeholder="Ej: ¿Qué socios deben más de una cuota y cuánto suma la deuda?" />

        <p className="form-label mb-2">Ideas para preguntar</p>
        <div className="d-flex flex-wrap gap-2">
          {sugerencias.map((s) => (
            <button key={s} type="button" className="chip" disabled={generando} onClick={() => pregunta.setValue('consulta', s)}>{s}</button>
          ))}
        </div>
      </Modal>
    );
  }

  // ---------- Paso 2: revisar el borrador y guardar ----------
  return (
    <Modal show={show} onClose={guardando ? () => {} : onClose} title={reporte ? 'Editar reporte' : 'Revisá el reporte'} size="xl" as="form" onSubmit={guardar}
      footer={(
        <>
          {!reporte && (
            <button type="button" className="btn btn-link me-auto" onClick={() => setBorrador(null)} disabled={guardando}>
              <i className="bi bi-arrow-left me-1" />Cambiar la pregunta
            </button>
          )}
          <button type="button" className="btn btn-link" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando && <span className="spinner-border spinner-border-sm me-2" />}Guardar reporte
          </button>
        </>
      )}
    >
      {borrador.consulta && <p className="consulta"><i className="bi bi-chat-square-text me-2" />{borrador.consulta}</p>}
      {!reporte && (
        <p className={`motor-reporte ${borrador.origen === 'ia' ? 'con-ia' : ''}`}>
          <i className={`bi ${borrador.origen === 'ia' ? 'bi-stars' : 'bi-cpu'} me-2`} aria-hidden="true" />
          {borrador.origen === 'ia'
            ? <>Respondió la IA: <b>{borrador.modelo_ia}</b>. Las cifras exactas las calculó el sistema.</>
            : <>Respondió el <b>motor local</b>: buscó en la fuente lo que menciona tu pregunta y calculó las cifras.</>}
        </p>
      )}
      {!reporte && borrador.aviso && <p className="limitaciones">{borrador.aviso}</p>}

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
