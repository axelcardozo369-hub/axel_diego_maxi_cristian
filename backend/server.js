import app from "./app.js";
import { env } from "./src/config/env.js";
import { sequelize } from "./src/models/index.js";
import { estadoIA } from "./src/services/ia/index.js";
import { retomarPendientes } from "./src/services/procesador.service.js";

const iniciarServidor = async () => {
  try {
    await sequelize.authenticate();
    console.log("✔ Conexión a MySQL establecida");

    // ¡NUNCA force: true acá! Borra TODAS las tablas y datos en cada inicio.
    // sync() solo crea las tablas que faltan. Si agregaste columnas nuevas,
    // poné DB_SYNC_ALTER=true UNA vez (o corré database/migracion_v2.sql).
    await sequelize.sync({ alter: env.DB_SYNC_ALTER });
    console.log(
      env.DB_SYNC_ALTER
        ? "✔ Modelos sincronizados (alter: tablas ajustadas a los modelos)"
        : "✔ Modelos sincronizados",
    );

    const ia = estadoIA();
    console.log(
      ia.configurada
        ? `✔ IA activa: ${ia.proveedor} (${ia.modelo}). Si falla, responde el motor local.`
        : `ℹ Sin IA: ${ia.motivo}`,
    );

    app.listen(env.PORT, async () => {
      console.log(`🚀 InfoHub corriendo en http://localhost:${env.PORT}`);
      const retomadas = await retomarPendientes();
      if (retomadas)
        console.log(
          `↻ Retomando ${retomadas} fuente(s) que quedaron sin procesar`,
        );
    });
  } catch (error) {
    console.error("✖ No se pudo iniciar el servidor:", error.message);
    process.exit(1);
  }
};

iniciarServidor();
