import { useCallback, useEffect, useState } from 'react';
import { categoriesApi, dataSourcesApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';
import EstadoIA from '../components/EstadoIA.jsx';
import DataSourceModal from '../components/DataSourceModal.jsx';
import FuenteDetalle from '../components/FuenteDetalle.jsx';
import ReportModal from '../components/ReportModal.jsx';
import MultiReportModal from '../components/MultiReportModal.jsx';
import CategoriasPanel from '../components/CategoriasPanel.jsx';
import { TIPOS_FUENTE, haceDias, puedeEditar, tamano, enProceso } from '../utils/formato.js';

export default function Fuentes() {
  const { usuario } = useAuth();
  const { notificar, confirmar } = useFeedback();
  const editable = puedeEditar(usuario);

  const [fuentes, setFuentes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ q: '', tipo_fuente: '', category_id: '' });
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalFuente, setModalFuente] = useState({ abierto: false, fuente: null });
  const [modalReporte, setModalReporte] = useState({ abierto: false, fuente: '' });
  const [detalle, setDetalle] = useState(null);
  // Selección para reportes de varias fuentes (el orden importa al comparar)
  const [seleccion, setSeleccion] = useState([]);
  const [modalMultiple, setModalMultiple] = useState({ abierto: false, ids: [] });
  const alternarSeleccion = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const cargarCategorias = useCallback(() => categoriesApi.listar().then(setCategorias).catch((e) => notificar(e.message, 'error')), [notificar]);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    setError('');
    try {
      setFuentes(await dataSourcesApi.listar(filtros));
    } catch (e) {
      if (!silencioso) setError(e.message);
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [filtros]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarCategorias(); }, [cargarCategorias]);

  // Mientras la IA identifica alguna fuente, la lista se actualiza sola cada 3 s
  const hayEnProceso = fuentes.some(enProceso);
  useEffect(() => {
    if (!hayEnProceso) return undefined;
    const t = setInterval(() => cargar({ silencioso: true }), 3000);
    return () => clearInterval(t);
  }, [hayEnProceso, cargar]);

  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.q === busqueda ? f : { ...f, q: busqueda })), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cerrarDetalle = useCallback(() => setDetalle(null), []);
  const preguntar = useCallback((id) => { setDetalle(null); setModalReporte({ abierto: true, fuente: id }); }, []);

  const abrirEdicion = async (id) => {
    try {
      setModalFuente({ abierto: true, fuente: await dataSourcesApi.obtener(id) });
    } catch (e) {
      notificar(e.message, 'error');
    }
  };

  const reintentar = async (f) => {
    try {
      await dataSourcesApi.reprocesar(f.id);
      notificar('Se vuelve a procesar la fuente');
      cargar({ silencioso: true });
    } catch (e) {
      notificar(e.message, 'error');
    }
  };

  const eliminar = async (f) => {
    if (!(await confirmar(`¿Eliminar "${f.titulo}"? Se da de baja pero queda en el historial.`))) return;
    try {
      await dataSourcesApi.eliminar(f.id);
      notificar('Fuente eliminada');
      cargar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  };

  const hayFiltros = filtros.q || filtros.tipo_fuente || filtros.category_id;

  return (
    <>
      <header className="encabezado">
        <div>
          <h1 className="titulo-pagina">Fuentes de datos</h1>
          <p className="text-secundario mb-0">Planillas, documentos, fotos, audios o videos: todo en un solo lugar.</p>
        </div>
        {editable && <button type="button" className="btn btn-primario" onClick={() => setModalFuente({ abierto: true, fuente: null })}><i className="bi bi-plus-lg me-1" />Cargar fuentes</button>}
      </header>

      <div className="row g-4">
        <div className="col-xl-9">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <input type="search" className="form-control buscador" placeholder="Buscar por título o identificador" aria-label="Buscar"
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <select className="form-select w-auto" aria-label="Tipo de fuente" value={filtros.tipo_fuente} onChange={(e) => setFiltros({ ...filtros, tipo_fuente: e.target.value })}>
              <option value="">Todos los tipos</option>
              {Object.entries(TIPOS_FUENTE).map(([v, t]) => <option key={v} value={v}>{t.texto}</option>)}
            </select>
            <select className="form-select w-auto" aria-label="Categoría" value={filtros.category_id} onChange={(e) => setFiltros({ ...filtros, category_id: e.target.value })}>
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {cargando ? <Loading texto="Cargando fuentes..." /> : error ? (
            <EmptyState icono="bi-wifi-off" titulo="No se pudieron cargar las fuentes" texto={error} accion={<button className="btn btn-primario" onClick={() => cargar()}>Reintentar</button>} />
          ) : fuentes.length === 0 ? (
            <EmptyState icono={hayFiltros ? 'bi-search' : 'bi-collection'}
              titulo={hayFiltros ? 'Ninguna fuente coincide con la búsqueda' : 'Todavía no hay fuentes cargadas'}
              texto={hayFiltros ? 'Probá con otras palabras o sacá los filtros.' : 'Subí una planilla, un PDF, una foto o un audio para empezar.'}
              accion={!hayFiltros && editable && <button className="btn btn-primario" onClick={() => setModalFuente({ abierto: true, fuente: null })}>Cargar fuente</button>} />
          ) : (
            <div className="lista-fuentes">
              {editable && (
                <div className={`barra-seleccion ${seleccion.length ? 'activa' : ''}`} role="region" aria-label="Fuentes seleccionadas">
                  {seleccion.length === 0 ? (
                    <span className="small text-secundario"><i className="bi bi-check2-square me-1" />Marcá dos o más fuentes para compararlas, consolidarlas o preguntarles juntas.</span>
                  ) : (
                    <>
                      <span className="small fw-bold">{seleccion.length} {seleccion.length === 1 ? 'fuente seleccionada' : 'fuentes seleccionadas'}</span>
                      <span className="ms-auto d-flex gap-2 flex-wrap">
                        <button type="button" className="btn btn-sm btn-secundario" disabled={seleccion.length !== 2}
                          title={seleccion.length !== 2 ? 'Para comparar elegí exactamente 2' : ''}
                          onClick={() => setModalMultiple({ abierto: true, ids: seleccion })}><i className="bi bi-arrow-left-right me-1" />Comparar</button>
                        <button type="button" className="btn btn-sm btn-primario" disabled={seleccion.length < 2}
                          onClick={() => setModalMultiple({ abierto: true, ids: seleccion })}><i className="bi bi-union me-1" />Consolidar o preguntar</button>
                        <button type="button" className="btn btn-sm btn-link" onClick={() => setSeleccion([])}>Limpiar</button>
                      </span>
                    </>
                  )}
                </div>
              )}
              {fuentes.map((f) => (
                <article key={f.id} className={`fila-fuente ${seleccion.includes(f.id) ? 'seleccionada' : ''}`}>
                  <div className="fuente-icono" aria-hidden="true"><i className={`bi ${TIPOS_FUENTE[f.tipo_fuente]?.icono}`} /></div>
                  <div className="fuente-cuerpo">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      {editable && ['listo', 'sin_ia'].includes(f.estado_ia) && (
                        <input type="checkbox" className="form-check-input m-0" checked={seleccion.includes(f.id)}
                          onChange={() => alternarSeleccion(f.id)} aria-label={`Seleccionar ${f.titulo}`} />
                      )}
                      <button type="button" className="fuente-titulo" onClick={() => setDetalle(f.id)}>{f.titulo}</button>
                      <EstadoIA fuente={f} />
                    </div>
                    <p className="small mb-1 text-secundario">
                      <span className="mono">{f.identificador}</span>
                      {f.archivo_nombre && <> · {f.archivo_nombre}</>}
                      {f.tamano_bytes != null && <> · {tamano(f.tamano_bytes)}</>}
                      {' '}· {haceDias(f.createdAt)} · {f.total_reportes} {Number(f.total_reportes) === 1 ? 'reporte' : 'reportes'}
                    </p>
                    {f.descripcion_ia && <p className="fuente-descripcion">{f.descripcion_ia}</p>}
                    {f.estado_ia === 'error' && <p className="small texto-peligro mb-1"><i className="bi bi-exclamation-triangle me-1" />{f.error_ia}</p>}
                    {f.estado_ia === 'pendiente' && f.metadata?.proximo_reintento && (
                      <p className="small text-secundario mb-1"><i className="bi bi-clock-history me-1" />{f.error_ia}</p>
                    )}
                    {f.estado_ia === 'listo' && f.metadata?.ia_aviso && (
                      <p className="aviso-local"><i className="bi bi-info-circle me-1" />{f.metadata.ia_aviso}</p>
                    )}
                    {f.estado_ia === 'sin_ia' && f.error_ia && <p className="small text-secundario mb-1"><i className="bi bi-info-circle me-1" />{f.error_ia}</p>}
                    {f.categorias.length > 0 && (
                      <div className="d-flex flex-wrap gap-1">
                        {f.categorias.map((c) => <span key={c.id} className="etiqueta" style={{ '--chip-color': c.color }}>{c.nombre}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="fuente-acciones">
                    {editable && ['listo', 'sin_ia'].includes(f.estado_ia) && (
                      <button type="button" className="btn btn-sm btn-secundario" onClick={() => preguntar(f.id)}><i className="bi bi-chat-square-text me-1" />Preguntar</button>
                    )}
                    {editable && f.estado_ia === 'error' && (
                      <button type="button" className="btn btn-sm btn-secundario" onClick={() => reintentar(f)}><i className="bi bi-arrow-repeat me-1" />Reintentar</button>
                    )}
                    {editable && f.estado_ia === 'listo' && f.metadata?.ia_aviso && (
                      <button type="button" className="btn btn-sm btn-link" onClick={() => reintentar(f)} title="Volver a pedirle a la IA que identifique la fuente"><i className="bi bi-stars me-1" />Mejorar con IA</button>
                    )}
                    <button type="button" className="btn-icono" aria-label={`Ver ${f.titulo}`} onClick={() => setDetalle(f.id)}><i className="bi bi-eye" /></button>
                    {editable && <button type="button" className="btn-icono" aria-label={`Editar ${f.titulo}`} onClick={() => abrirEdicion(f.id)}><i className="bi bi-pencil" /></button>}
                    {editable && <button type="button" className="btn-icono" aria-label={`Eliminar ${f.titulo}`} onClick={() => eliminar(f)}><i className="bi bi-trash" /></button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="col-xl-3">
          <CategoriasPanel categorias={categorias} editable={editable} onChange={() => { cargarCategorias(); cargar(); }} />
        </div>
      </div>

      <DataSourceModal show={modalFuente.abierto} fuente={modalFuente.fuente} categorias={categorias}
        onClose={() => setModalFuente({ abierto: false, fuente: null })}
        onSaved={() => { setModalFuente({ abierto: false, fuente: null }); cargar(); }} />

      <MultiReportModal show={modalMultiple.abierto} fuentesIniciales={modalMultiple.ids}
        onClose={() => setModalMultiple({ abierto: false, ids: [] })}
        onSaved={() => { setModalMultiple({ abierto: false, ids: [] }); setSeleccion([]); cargar(); }} />

      <FuenteDetalle id={detalle} onClose={cerrarDetalle} onPreguntar={editable ? preguntar : null} />

      <ReportModal show={modalReporte.abierto} fuenteInicial={modalReporte.fuente}
        onClose={() => setModalReporte({ abierto: false, fuente: '' })}
        onSaved={() => { setModalReporte({ abierto: false, fuente: '' }); notificar('Lo encontrás en el Tablero'); cargar(); }} />
    </>
  );
}
