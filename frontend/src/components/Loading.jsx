export default function Loading({ texto = 'Cargando...' }) {
  return (
    <div className="estado" role="status">
      <div className="spinner-border mb-3" aria-hidden="true" />
      <p className="mb-0">{texto}</p>
    </div>
  );
}
