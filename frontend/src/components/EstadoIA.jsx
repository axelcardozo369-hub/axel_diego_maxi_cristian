import { ESTADOS_IA, MOTORES, hora } from '../utils/formato.js';

// Estado de la fuente + quién la procesó (análisis local o proveedor de IA)
export default function EstadoIA({ fuente }) {
  const estado = ESTADOS_IA[fuente.estado_ia] || ESTADOS_IA.pendiente;
  const trabajando = ['pendiente', 'procesando'].includes(fuente.estado_ia);
  const reintento = fuente.metadata?.proximo_reintento;
  const motor = MOTORES[fuente.metadata?.procesado_por];

  return (
    <span className="d-inline-flex flex-wrap gap-1 align-items-center">
      <span className={`estado-ia ${estado.clase}`} title={fuente.error_ia || ''}>
        {trabajando && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
        {reintento && fuente.estado_ia === 'pendiente' ? `Reintenta ${hora(reintento)}` : estado.texto}
      </span>
      {fuente.estado_ia === 'listo' && motor && (
        <span className="motor" title="Quién identificó la fuente"><i className={`bi ${motor.icono} me-1`} aria-hidden="true" />{motor.texto}</span>
      )}
    </span>
  );
}
