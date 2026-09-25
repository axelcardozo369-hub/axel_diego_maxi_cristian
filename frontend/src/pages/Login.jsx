import { useState } from 'react';
import Field from '../components/Field.jsx';
import { useForm, reglas } from '../hooks/useForm.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { TIPOS_ORGANIZACION } from '../utils/formato.js';

export default function Login() {
  const [modo, setModo] = useState('ingresar');

  return (
    <div className="pantalla-login">
      <section className="login-relato">
        <p className="marca-nombre">InfoHub</p>
        <h1>
          Planillas, cuadernos y formularios sueltos,
          <span className="resaltado"> convertidos en información para decidir.</span>
        </h1>
        <p>Para emprendimientos, organizaciones, instituciones y comunidades.</p>
      </section>

      <section className="login-caja">
        <div className="nav nav-underline mb-4" role="tablist">
          <button type="button" role="tab" aria-selected={modo === 'ingresar'} className={`nav-link ${modo === 'ingresar' ? 'active' : ''}`} onClick={() => setModo('ingresar')}>Ingresar</button>
          <button type="button" role="tab" aria-selected={modo === 'registrar'} className={`nav-link ${modo === 'registrar' ? 'active' : ''}`} onClick={() => setModo('registrar')}>Crear cuenta</button>
        </div>
        {modo === 'ingresar' ? <FormIngresar /> : <FormRegistrar />}
      </section>
    </div>
  );
}

function FormIngresar() {
  const { login } = useAuth();
  const { notificar } = useFeedback();
  const [enviando, setEnviando] = useState(false);
  const form = useForm({ email: '', password: '' }, {
    email: reglas.email,
    password: reglas.requerido('Escribí tu contraseña'),
  });

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.validarTodo()) return;
    setEnviando(true);
    try {
      await login(form.values);
    } catch (error) {
      const sueltos = form.aplicarErroresServidor(error.errors);
      notificar(sueltos[0] || error.message, 'error');
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <Field label="Email" form={form} name="email" type="email" autoComplete="email" />
      <Field label="Contraseña" form={form} name="password" type="password" autoComplete="current-password" />
      <button type="submit" className="btn btn-primario w-100" disabled={enviando}>
        {enviando && <span className="spinner-border spinner-border-sm me-2" />}Ingresar
      </button>
      <p className="small text-secundario mt-3 mb-0">Demo: admin@infohub.local · clave infohub2026</p>
    </form>
  );
}

function FormRegistrar() {
  const { register } = useAuth();
  const { notificar } = useFeedback();
  const [enviando, setEnviando] = useState(false);
  const form = useForm(
    { nombre: '', email: '', password: '', organizacion: '', tipo_organizacion: 'organizacion' },
    {
      nombre: reglas.largo(2, 100, 'Entre 2 y 100 caracteres'),
      email: reglas.email,
      password: reglas.largo(8, 200, 'Mínimo 8 caracteres'),
    }
  );

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.validarTodo()) return;
    setEnviando(true);
    try {
      await register(form.values);
      notificar('Cuenta creada. ¡Bienvenida/o!');
    } catch (error) {
      const sueltos = form.aplicarErroresServidor(error.errors);
      notificar(sueltos[0] || error.message, 'error');
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <Field label="Nombre y apellido" form={form} name="nombre" autoComplete="name" />
      <Field label="Email" form={form} name="email" type="email" autoComplete="email" />
      <Field label="Contraseña" form={form} name="password" type="password" autoComplete="new-password" help="Mínimo 8 caracteres." />
      <div className="row">
        <div className="col-7"><Field label="Organización" form={form} name="organizacion" placeholder="Opcional" /></div>
        <div className="col-5">
          <Field label="Tipo" form={form} name="tipo_organizacion" as="select">
            {Object.entries(TIPOS_ORGANIZACION).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Field>
        </div>
      </div>
      <button type="submit" className="btn btn-primario w-100" disabled={enviando}>
        {enviando && <span className="spinner-border spinner-border-sm me-2" />}Crear cuenta
      </button>
    </form>
  );
}
