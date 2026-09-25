// Campo de formulario con etiqueta, ayuda y error (de validación local o de express-validator)
export default function Field({ label, form, name, as = 'input', help, children, className = '', ...rest }) {
  const error = form.errors[name];
  const props = form.campo(name);
  const id = `campo-${name}`;
  const clase = `${as === 'select' ? 'form-select' : 'form-control'} ${error ? 'is-invalid' : ''} ${className}`;

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>{label}</label>
      {as === 'select' && <select id={id} className={clase} {...props} {...rest}>{children}</select>}
      {as === 'textarea' && <textarea id={id} className={clase} {...props} {...rest} />}
      {as === 'input' && <input id={id} className={clase} {...props} {...rest} />}
      {help && !error && <div className="form-text">{help}</div>}
      {error && <div className="invalid-feedback d-block">{error}</div>}
    </div>
  );
}
