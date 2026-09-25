import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, reportsApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import ReporteView from '../components/ReporteView.jsx';
import ReportModal from '../components/ReportModal.jsx';
import { ESTADOS, fecha, haceDias, puedeEditar } from '../utils/formato.js';

const FILTROS = [['', 'Todos'], ['publicado', 'Publicados'], ['borrador', 'Borradores'], ['archivado', 'Archivados']];

export default function Dashboard() {
  const { usuario } = useAuth();
  const { notificar, confirmar } = useFeedback();
  const editable = puedeEditar(usuario);

  const [resumen, setResumen] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ abierto: false, reporte: null, fuente: '' });
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [r, lista] = await Promise.all([dashboardApi.resumen(), reportsApi.listar({ estado })]);
      setResumen(r);
      setReportes(lista);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (r) => {
    if (!(await confirmar(`¿Eliminar el reporte de "${r.fuente?.titulo}"? Queda en el historial como dado de baja.`))) return;
    try {
      await reportsApi.eliminar(r.id);
      notificar('Reporte eliminado');
      cargar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  };

  const abrirNuevo = (fuente = '') => setModal({ abierto: true, reporte: null, fuente });
  const alGuardar = () => { setModal({ abierto: false, reporte: null, fuente: '' }); cargar(); };

  if (cargando && !resumen) return <Loading texto="Armando el tablero..." />;
  if (error && !resumen) return <EmptyState icono="bi-wifi-off" titulo="No se pudo cargar el tablero" texto={error} accion={<button className="btn btn-primario" onClick={cargar}>Reintentar</button>} />;

  const { totales, reportes_por_estado: porEstado, fuentes_sin_reporte: sinReporte, fuentes_desactualizadas: viejas, ia } = resumen;

  return (
    <>
      <header className="encabezado">
        <div>
          <h1 className="titulo-pagina">Tablero</h1>
          {/* La "foto" de la situación, escrita en una frase */}
          <p className="foto">
            Tenés <mark>{totales.fuentes} {totales.fuentes === 1 ? 'fuente' : 'fuentes'}</mark> cargadas
            y <mark>{porEstado.publicado} {porEstado.publicado === 1 ? 'reporte publicado' : 'reportes publicados'}</mark>.
            {sinReporte.length > 0 && <> {sinReporte.length === 1 ? 'Una fuente todavía no se convirtió' : `${sinReporte.length} fuentes todavía no se convirtieron`} en información útil.</>}
          </p>
        </div>
        {editable && <button type="button" className="btn btn-primario" onClick={() => abrirNuevo()}><i className="bi bi-plus-lg me-1" />Nuevo reporte</button>}
      </header>

      {ia && !ia.configurada && (
        <div className="aviso-ia mb-4" role="note">
          <i className="bi bi-cpu" aria-hidden="true" />
          <p className="mb-0"><b>Funcionando con el motor local.</b> Planillas, JSON, Excel, Word y PDF con texto se analizan igual y los reportes responden buscando en tus datos. Para fotos, audios y videos, o respuestas redactadas por IA, configurá Gemini u OpenRouter. <Link to="/ia">Ver cómo funciona</Link>.</p>
        </div>
      )}
      {resumen.fuentes_en_proceso > 0 && (
        <p className="small text-secundario mb-4"><span className="spinner-border spinner-border-sm me-2" />La IA está identificando {resumen.fuentes_en_proceso} {resumen.fuentes_en_proceso === 1 ? 'fuente' : 'fuentes'}.</p>
      )}

      {totales.fuentes === 0 ? (
        <EmptyState icono="bi-collection" titulo="Empezá cargando una fuente de datos"
          texto="Una planilla de ventas, la lista de socios, un formulario: lo que hoy está disperso."
          accion={<Link to="/fuentes" className="btn btn-primario">Ir a fuentes de datos</Link>} />
      ) : (
        <div className="row g-4 mb-4">
          <div className="col-lg-6">
            <section className="panel h-100">
              <h2 className="h6"><i className="bi bi-hourglass-split me-2" />Sin reporte todavía</h2>
              {sinReporte.length === 0 ? <p className="small text-secundario mb-0">Todas las fuentes tienen al menos un reporte.</p> : (
                <ul className="lista-alertas">
                  {sinReporte.map((f) => (
                    <li key={f.id}>
                      <div><p className="mb-0 fw-bold">{f.titulo}</p><p className="mb-0 small mono">{f.identificador}</p></div>
                      {editable && <button type="button" className="btn btn-sm btn-secundario" onClick={() => abrirNuevo(f.id)}>Preguntar</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="col-lg-6">
            <section className="panel h-100">
              <h2 className="h6"><i className="bi bi-clock-history me-2" />Sin actualizar hace más de {resumen.dias_desactualizada} días</h2>
              {viejas.length === 0 ? <p className="small text-secundario mb-0">Todas las fuentes están al día.</p> : (
                <ul className="lista-alertas">
                  {viejas.map((f) => (
                    <li key={f.id}>
                      <div><p className="mb-0 fw-bold">{f.titulo}</p><p className="mb-0 small">Última actualización {haceDias(f.updatedAt)}</p></div>
                      {editable && <Link to="/fuentes" className="btn btn-sm btn-link">Actualizar</Link>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      <section>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 className="h5 mb-0">Reportes</h2>
          <div className="filtros" role="group" aria-label="Filtrar por estado">
            {FILTROS.map(([valor, texto]) => (
              <button key={valor} type="button" className={`filtro ${estado === valor ? 'activo' : ''}`} aria-pressed={estado === valor} onClick={() => setEstado(valor)}>{texto}</button>
            ))}
          </div>
        </div>

        {cargando ? <Loading texto="Cargando reportes..." /> : reportes.length === 0 ? (
          <EmptyState icono="bi-file-earmark-bar-graph" titulo={estado ? 'No hay reportes con ese estado' : 'Todavía no hay reportes'}
            texto={editable ? 'Elegí una fuente, escribí qué querés saber y la IA arma el reporte.' : ''}
            accion={editable && !estado && totales.fuentes > 0 && <button className="btn btn-primario" onClick={() => abrirNuevo()}>Crear el primero</button>} />
        ) : (
          <div className="grilla-reportes">
            {reportes.map((r) => (
              <article key={r.id} className="tarjeta-reporte">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <h3 className="h6 mb-1">{r.titulo || r.fuente?.titulo}</h3>
                    <p className="small mb-0 text-secundario">{r.fuente?.titulo} · <span className="mono">{r.fuente?.identificador}</span></p>
                  </div>
                  <span className={`estado-badge ${ESTADOS[r.estado].clase}`}>{ESTADOS[r.estado].texto}</span>
                </div>
                {r.consulta && <p className="consulta consulta-chica"><i className="bi bi-chat-square-text me-2" />{r.consulta}</p>}
                {r.metricas_clave?.indicadores?.length > 0 && (
                  <div className="cifras">
                    {r.metricas_clave.indicadores.slice(0, 3).map((ind) => (
                      <span key={ind.nombre} className="small">{ind.nombre}: <mark>{ind.valor}</mark></span>
                    ))}
                  </div>
                )}
                <p className="resumen">{r.resumen_ejecutivo}</p>
                <p className="small text-secundario mb-0">
                  {r.autor?.nombre} · {fecha(r.updatedAt)} · {r.origen === 'ia' ? <><i className="bi bi-stars" /> IA</> : 'Básico'}
                </p>
                <div className="acciones">
                  <button type="button" className="btn btn-sm btn-link" onClick={() => setDetalle(r)}>Ver reporte</button>
                  {editable && <button type="button" className="btn btn-sm btn-link" onClick={() => setModal({ abierto: true, reporte: r, fuente: '' })}>Editar</button>}
                  {editable && <button type="button" className="btn btn-sm btn-link texto-peligro" onClick={() => eliminar(r)}>Eliminar</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ReportModal show={modal.abierto} reporte={modal.reporte} fuenteInicial={modal.fuente}
        onClose={() => setModal({ abierto: false, reporte: null, fuente: '' })} onSaved={alGuardar} />

      <Modal show={!!detalle} onClose={() => setDetalle(null)} title={detalle?.titulo || detalle?.fuente?.titulo || 'Reporte'} size="xl">
        {detalle && (
          <>
            {detalle.consulta && <p className="consulta"><i className="bi bi-chat-square-text me-2" />{detalle.consulta}</p>}
            <p className="resumen-completo">{detalle.resumen_ejecutivo}</p>
            <ReporteView metricas={detalle.metricas_clave} />
            <p className="small text-secundario mt-3 mb-0">
              Fuente: {detalle.fuente?.titulo} ({detalle.fuente?.identificador}) · {detalle.autor?.nombre} · {fecha(detalle.updatedAt)}
              {detalle.modelo_ia && <> · Generado con {detalle.modelo_ia}</>}
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
