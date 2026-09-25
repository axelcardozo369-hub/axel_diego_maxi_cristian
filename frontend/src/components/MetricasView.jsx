import { numero } from '../utils/formato.js';

// Muestra las métricas clave que generó el analizador
export default function MetricasView({ metricas }) {
  if (!metricas) return null;

  if (metricas.tipo === 'texto') {
    return (
      <div className="metricas">
        <div className="metricas-fila">
          <Dato valor={metricas.palabras} etiqueta="palabras" />
          <Dato valor={metricas.lineas} etiqueta="líneas" />
        </div>
        <p className="small text-secundario mb-0">Es texto libre. Pasalo a una planilla para obtener totales y comparaciones.</p>
      </div>
    );
  }

  // Métricas cargadas a mano (sin el formato del analizador)
  if (metricas.tipo !== 'tabla') {
    return (
      <dl className="metricas-libres">
        {Object.entries(metricas).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>
        ))}
      </dl>
    );
  }

  const completitud = metricas.completitud_pct ?? 100;
  return (
    <div className="metricas">
      <div className="metricas-fila">
        <Dato valor={metricas.filas} etiqueta="registros" />
        <Dato valor={metricas.columnas} etiqueta="columnas" />
        <Dato valor={`${numero(completitud)}%`} etiqueta="completo" alerta={completitud < 90} />
        <Dato valor={metricas.filas_duplicadas} etiqueta="duplicados" alerta={metricas.filas_duplicadas > 0} />
      </div>

      <div className="progress barra-completitud" role="progressbar" aria-label="Completitud de los datos"
        aria-valuenow={completitud} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar" style={{ width: `${completitud}%` }} />
      </div>

      {metricas.fechas?.length > 0 && (
        <p className="small mb-3">
          <i className="bi bi-calendar3 me-1" />
          {metricas.fechas.map((f) => `${f.columna}: del ${f.desde} al ${f.hasta}`).join(' · ')}
        </p>
      )}

      {metricas.numericas?.length > 0 && (
        <div className="table-responsive mb-3">
          <table className="table table-sm tabla-metricas">
            <thead><tr><th>Columna</th><th className="text-end">Total</th><th className="text-end">Promedio</th><th className="text-end">Mín.</th><th className="text-end">Máx.</th></tr></thead>
            <tbody>
              {metricas.numericas.map((c) => (
                <tr key={c.columna}>
                  <td>{c.columna}</td>
                  <td className="text-end"><mark>{numero(c.suma)}</mark></td>
                  <td className="text-end">{numero(c.promedio)}</td>
                  <td className="text-end">{numero(c.minimo)}</td>
                  <td className="text-end">{numero(c.maximo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {metricas.categoricas?.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {metricas.categoricas.slice(0, 3).map((c) => (
            <p key={c.columna} className="small mb-0">
              <b>{c.columna}:</b>{' '}
              {c.top.map((t) => `${t.valor} (${t.cantidad})`).join(', ')}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Dato({ valor, etiqueta, alerta = false }) {
  return (
    <div className={`dato ${alerta ? 'dato-alerta' : ''}`}>
      <span className="dato-valor">{valor}</span>
      <span className="dato-etiqueta">{etiqueta}</span>
    </div>
  );
}
