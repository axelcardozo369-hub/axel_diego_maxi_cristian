import { useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import { useForm, reglas } from '../hooks/useForm.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { profileApi, usersApi } from '../services/api.js';
import { TIPOS_ORGANIZACION } from '../utils/formato.js';

export default function Perfil() {
  const { usuario, refrescar } = useAuth();
  const { notificar } = useFeedback();
  const [guardando, setGuardando] = useState(false);
  const form = useForm(
    { nombre: '', email: '', password: '', organizacion: '', tipo_organizacion: 'organizacion', moneda: 'ARS' },
    {
      nombre: reglas.largo(2, 100, 'Entre 2 y 100 caracteres'),
      email: reglas.email,
      password: (v) => (!v || v.length >= 8 ? '' : 'Mínimo 8 caracteres'),
      moneda: (v) => (/^[A-Za-z]{3}$/.test(v) ? '' : 'Código de 3 letras (ej: ARS)'),
    }
  );

  useEffect(() => {
    form.reset({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      organizacion: usuario.perfil?.organizacion || '',
      tipo_organizacion: usuario.perfil?.tipo_organizacion || 'organizacion',
      moneda: usuario.perfil?.moneda || 'ARS',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.validarTodo()) return;
    const { nombre, email, password, organizacion, tipo_organizacion, moneda } = form.values;
    setGuardando(true);
    try {
      // Dos recursos, una sola acción: el usuario (1) y su perfil (1)
      await usersApi.actualizar(usuario.id, { nombre, email, ...(password ? { password } : {}) });
      await profileApi.actualizar({ organizacion, tipo_organizacion, moneda });
      await refrescar();
      notificar('Perfil actualizado');
    } catch (error) {
      const sueltos = form.aplicarErroresServidor(error.errors);
      if (error.status === 409) form.aplicarErroresServidor([{ path: 'email', msg: error.message }]);
      notificar(sueltos[0] || error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <header className="encabezado"><h1 className="titulo-pagina">Perfil</h1></header>
      <form className="panel formulario-angosto" onSubmit={guardar} noValidate>
        <h2 className="h6">Tus datos</h2>
        <Field label="Nombre y apellido" form={form} name="nombre" />
        <Field label="Email" form={form} name="email" type="email" />
        <Field label="Nueva contraseña" form={form} name="password" type="password" autoComplete="new-password" help="Dejala vacía si no querés cambiarla." />
        <h2 className="h6 mt-4">Tu organización</h2>
        <Field label="Nombre de la organización" form={form} name="organizacion" />
        <div className="row">
          <div className="col-8">
            <Field label="Tipo" form={form} name="tipo_organizacion" as="select">
              {Object.entries(TIPOS_ORGANIZACION).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Field>
          </div>
          <div className="col-4"><Field label="Moneda" form={form} name="moneda" maxLength={3} /></div>
        </div>
        <button type="submit" className="btn btn-primario" disabled={guardando}>
          {guardando && <span className="spinner-border spinner-border-sm me-2" />}Guardar cambios
        </button>
      </form>
    </>
  );
}
