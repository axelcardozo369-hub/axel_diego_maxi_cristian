import MetricasView from './MetricasView.jsx';

// Muestra el contenido de un reporte: indicadores, hallazgos,
// recomendaciones, tabla y limitaciones. Los reportes viejos (v1)
// se siguen viendo con MetricasView.
export default function ReporteView({ metricas }) {
  if (!metricas) return null;
  if (metricas.tipo !== 'reporte') return <MetricasView metricas={metricas} />;

  const { indicadores = [], hallazgos = [], recomendaciones = [], tabla, tablas_extra = [], fuentes = [], limitaciones } = metricas;
  // Tabla principal + tablas exactas calculadas por el sistema (comparaciones y consolidaciones)
  const tablas = [tabla, ...tablas_extra].filter((t) => t?.columnas?.length > 0 && t?.filas?.length > 0);

  return (
    <div className="reporte">
      {fuentes.length > 1 && (
        <p className="small mb-0">
          <b>Fuentes:</b>{' '}
          {fuentes.map((f, i) => <span key={f.id} className="etiqueta me-1">{i + 1}. {f.titulo}</span>)}
        </p>
      )}
      {indicadores.length > 0 && (
        <div className="indicadores">
          {indicadores.map((ind, i) => (
            <div key={i} className="indicador">
              <span className="indicador-nombre">{ind.nombre}</span>
              <span className="indicador-valor"><mark>{ind.valor}</mark></span>
              {ind.contexto && <span className="indicador-contexto">{ind.contexto}</span>}
            </div>
          ))}
        </div>
      )}

      {hallazgos.length > 0 && (
        <section className="bloque">
          <h3 className="bloque-titulo"><i className="bi bi-search me-2" />Hallazgos</h3>
          <ul>{hallazgos.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </section>
      )}

      {recomendaciones.length > 0 && (
        <section className="bloque">
          <h3 className="bloque-titulo"><i className="bi bi-lightbulb me-2" />Recomendaciones</h3>
          <ul>{recomendaciones.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </section>
      )}

      {tablas.map((t, n) => (
        <section className="bloque" key={`${t.titulo}-${n}`}>
          {t.titulo && <h3 className="bloque-titulo"><i className="bi bi-table me-2" />{t.titulo}</h3>}
          <div className="table-responsive tabla-reporte">
            <table className="table table-sm tabla-metricas">
              <thead><tr>{t.columnas.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody>
                {t.filas.map((fila, i) => (
                  <tr key={i} className={/^total$/i.test(String(fila[0])) ? 'fila-total' : ''}>{fila.map((celda, j) => <td key={j}>{celda}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {limitaciones && (
        <p className="limitaciones"><i className="bi bi-info-circle me-2" />{limitaciones}</p>
      )}
    </div>
  );
}
