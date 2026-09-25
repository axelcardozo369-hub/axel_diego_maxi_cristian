export default function EmptyState({ icono = 'bi-inbox', titulo, texto, accion }) {
  return (
    <div className="estado">
      <i className={`bi ${icono}`} aria-hidden="true" />
      <p className="estado-titulo">{titulo}</p>
      {texto && <p className="mb-3">{texto}</p>}
      {accion}
    </div>
  );
}
