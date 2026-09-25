import { useCallback, useEffect, useState } from 'react';
import { iaApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import Loading from '../components/Loading.jsx';
import { MOTORES, hora } from '../utils/formato.js';

const PASOS = [
  { icono: 'bi-cpu', titulo: '1. Lectura local', texto: 'CSV, JSON, Excel, Word y PDF con texto se leen en el servidor. Es gratis, no tiene límites y funciona sin internet. La fuente queda lista enseguida.' },
  { icono: 'bi-stars', titulo: '2. IA como mejora', texto: 'Si hay IA configurada, se le manda una muestra chica para describir mejor la fuente. En los reportes recibe solo los fragmentos relacionados con tu pregunta, junto con las cifras exactas ya calculadas.' },
  { icono: 'bi-arrow-left-right', titulo: '3. Respaldo en cadena', texto: 'Se prueba Gemini (varios modelos en orden) y después OpenRouter. Si un proveedor se quedó sin cuota, se lo pone en pausa y no se lo vuelve a llamar hasta que pase la espera.' },
  { icono: 'bi-shield-check', titulo: '4. Nunca se traba', texto: 'Si ninguna IA responde, contesta el motor local: busca en tus datos lo que menciona la pregunta y calcula totales. Solo fotos, audios y videos necesitan IA; se reintentan solos más tarde.' },
];

const PROBLEMAS = [
  ['"Se agotó la cuota gratuita" (429)', 'Llegaste al límite del plan gratis. El sistema sigue con el motor local. En AI Studio (Gemini) mirá los límites de tu proyecto; en OpenRouter el plan gratis permite 50 pedidos por día sin créditos. Podés agregar más modelos en GEMINI_MODEL separados por coma.'],
  ['"La clave no es válida"', 'Revisá la clave en backend/.env y reiniciá el backend. Nunca compartas la clave: si se expuso, revocala y creá otra.'],
  ['"El modelo no existe"', 'El nombre en GEMINI_MODEL u OPENROUTER_MODEL cambió o no está disponible para tu cuenta. Usá "Probar conexión" para verificarlo.'],
  ['"No hay conexión a internet"', 'El servidor no llega al proveedor. Todo lo que es texto sigue funcionando con el motor local.'],
];

export default function IA() {
  const { usuario } = useAuth();
  const { notificar } = useFeedback();
  const [estado, setEstado] = useState(null);
  const [pruebas, setPruebas] = useState(null);
  const [probando, setProbando] = useState(false);

  const cargar = useCallback(() => iaApi.estado().then(setEstado).catch((e) => notificar(e.message, 'error')), [notificar]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 10000); // se actualiza solo
    return () => clearInterval(t);
  }, [cargar]);

  const probar = async () => {
    setProbando(true);
    try {
      const { resultados, estado: nuevo } = await iaApi.probar();
      setPruebas(resultados);
      setEstado(nuevo);
    } catch (e) {
      notificar(e.message, 'error');
    } finally {
      setProbando(false);
    }
  };

  if (!estado) return <Loading texto="Consultando el estado de la IA..." />;
  const hoy = estado.uso?.hoy || {};

  return (
    <>
      <header className="encabezado">
        <div>
          <h1 className="titulo-pagina">Cómo funciona la IA</h1>
          <p className="text-secundario mb-0">
            {estado.configurada
              ? <>Cadena activa: <b>{estado.proveedores.map((p) => MOTORES[p.nombre]?.texto || p.nombre).join(' → ')} → Análisis local</b></>
              : <>Sin IA configurada: todo funciona con el <b>análisis local</b>.</>}
          </p>
        </div>
        {usuario.rol === 'admin' && estado.configurada && (
          <button type="button" className="btn btn-primario" onClick={probar} disabled={probando}>
            {probando ? <><span className="spinner-border spinner-border-sm me-2" />Probando…</> : <><i className="bi bi-plug me-1" />Probar conexión</>}
          </button>
        )}
      </header>

      <div className="pasos-ia mb-4">
        {PASOS.map((p) => (
          <section key={p.titulo} className="panel paso-ia">
            <i className={`bi ${p.icono}`} aria-hidden="true" />
            <h2 className="h6">{p.titulo}</h2>
            <p className="small mb-0">{p.texto}</p>
          </section>
        ))}
      </div>

      {pruebas && (
        <section className="panel mb-4">
          <h2 className="h6">Resultado de la prueba</h2>
          <ul className="lista-alertas">
            {pruebas.map((r) => (
              <li key={r.proveedor}>
                <div>
                  <p className="mb-0 fw-bold">{MOTORES[r.proveedor]?.texto || r.proveedor} <span className="mono">{r.modelo}</span></p>
                  <p className={`mb-0 small ${r.ok ? '' : 'texto-peligro'}`}>{r.mensaje} · {r.ms} ms</p>
                </div>
                <span className={`estado-ia ${r.ok ? 'ia-listo' : 'ia-error'}`}>{r.ok ? 'Funciona' : 'Falla'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row g-4">
        <div className="col-lg-6">
          <section className="panel h-100">
            <h2 className="h6">Proveedores</h2>
            {estado.proveedores.length === 0 ? (
              <p className="small text-secundario mb-0">{estado.motivo}</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead><tr><th>Proveedor</th><th>Estado</th><th className="text-end">Hoy</th></tr></thead>
                  <tbody>
                    {estado.proveedores.map((p) => {
                      const u = hoy[p.nombre] || { llamadas: 0, exitos: 0, cuota: 0, errores: 0 };
                      return (
                        <tr key={p.nombre}>
                          <td>
                            <p className="mb-0 fw-bold">{MOTORES[p.nombre]?.texto || p.nombre}</p>
                            <p className="mb-0 small mono">{p.modelo}</p>
                            <p className="mb-0 small text-secundario">{p.lee_archivos ? 'Lee texto, PDF, fotos, audio y video' : 'Lee solo texto'}</p>
                          </td>
                          <td>
                            {p.en_pausa_hasta
                              ? <span className="estado-ia ia-proceso">En pausa hasta {hora(p.en_pausa_hasta)}</span>
                              : <span className="estado-ia ia-listo">Disponible</span>}
                          </td>
                          <td className="text-end small text-nowrap">
                            {u.exitos}/{u.llamadas} bien
                            {u.cuota > 0 && <><br /><span className="texto-peligro">{u.cuota} sin cuota</span></>}
                            {u.errores > 0 && <><br /><span className="texto-peligro">{u.errores} con error</span></>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <div className="col-lg-6">
          <section className="panel h-100">
            <h2 className="h6">Últimas llamadas</h2>
            {estado.uso.ultimos.length === 0 ? <p className="small text-secundario mb-0">Todavía no se llamó a ninguna IA desde que arrancó el servidor.</p> : (
              <ul className="lista-alertas">
                {estado.uso.ultimos.map((e, i) => (
                  <li key={i}>
                    <div>
                      <p className="mb-0 small"><b>{MOTORES[e.proveedor]?.texto || e.proveedor}</b> · {e.tarea === 'generarReporte' ? 'reporte' : e.tarea} · {hora(e.fecha)} · {e.ms} ms</p>
                      {e.error && <p className="mb-0 small texto-peligro">{e.error}</p>}
                    </div>
                    <i className={`bi ${e.ok ? 'bi-check-circle text-success' : 'bi-x-circle texto-peligro'}`} aria-label={e.ok ? 'bien' : 'falló'} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="panel mt-4">
        <h2 className="h6">Si ves un error</h2>
        <dl className="problemas mb-0">
          {PROBLEMAS.map(([titulo, texto]) => (
            <div key={titulo}><dt>{titulo}</dt><dd>{texto}</dd></div>
          ))}
        </dl>
      </section>
    </>
  );
}
