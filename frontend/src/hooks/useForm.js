import { useState } from 'react';

// Formularios con validación en tiempo real.
// reglas = { campo: (valor, todos) => 'mensaje de error' | '' }
export function useForm(inicial, reglas = {}) {
  const [values, setValues] = useState(inicial);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validarCampo = (nombre, valor, todos) => reglas[nombre]?.(valor, todos) || '';

  const setValue = (nombre, valor) => {
    // Actualización funcional: dos setValue seguidos no se pisan entre sí
    setValues((previos) => ({ ...previos, [nombre]: valor }));
    // Valida mientras escribe si el campo ya fue tocado o tiene contenido
    if (touched[nombre] || valor !== '') {
      setErrors((e) => ({ ...e, [nombre]: validarCampo(nombre, valor, { ...values, [nombre]: valor }) }));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValue(name, type === 'checkbox' ? checked : value);
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((er) => ({ ...er, [name]: validarCampo(name, values[name], values) }));
  };

  const validarTodo = () => {
    const nuevos = {};
    Object.keys(reglas).forEach((n) => { nuevos[n] = validarCampo(n, values[n], values); });
    setErrors(nuevos);
    setTouched(Object.fromEntries(Object.keys(reglas).map((n) => [n, true])));
    return Object.values(nuevos).every((m) => !m);
  };

  // Traduce el array de express-validator ({ path, msg }) a errores por campo.
  // Devuelve los mensajes que no corresponden a ningún campo del formulario.
  const aplicarErroresServidor = (lista = []) => {
    const porCampo = {};
    const sueltos = [];
    lista.forEach(({ path, msg }) => {
      const campo = String(path || '').split(/[.[]/)[0];
      if (campo in values) porCampo[campo] = msg;
      else sueltos.push(msg);
    });
    setErrors((e) => ({ ...e, ...porCampo }));
    return sueltos;
  };

  const reset = (nuevos = inicial) => {
    setValues(nuevos);
    setErrors({});
    setTouched({});
  };

  const campo = (nombre) => ({
    name: nombre,
    value: values[nombre] ?? '',
    onChange: handleChange,
    onBlur: handleBlur,
    'aria-invalid': errors[nombre] ? true : undefined,
  });

  return { values, errors, setValue, handleChange, validarTodo, aplicarErroresServidor, reset, campo };
}

// Reglas reutilizables
export const reglas = {
  requerido: (mensaje) => (v) => (String(v ?? '').trim() ? '' : mensaje),
  largo: (min, max, mensaje) => (v) => {
    const n = String(v ?? '').trim().length;
    return n >= min && n <= max ? '' : mensaje;
  },
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '').trim()) ? '' : 'Escribí un email válido'),
};
