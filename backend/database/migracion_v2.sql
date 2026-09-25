-- ============================================================
-- Migración de InfoHub v1 → v2 (sin perder datos)
-- Solo hace falta si ya tenías la base de la v1 con datos reales.
-- Si no, alcanza con: npm run seed
--   mysql -u root -p infohub < database/migracion_v2.sql
-- ============================================================

ALTER TABLE data_sources
  MODIFY titulo VARCHAR(200) NOT NULL,
  MODIFY contenido_crudo LONGTEXT NULL,
  ADD COLUMN archivo_nombre VARCHAR(255) NULL AFTER tipo_fuente,
  ADD COLUMN archivo_ruta VARCHAR(500) NULL AFTER archivo_nombre,
  ADD COLUMN mime_type VARCHAR(150) NULL AFTER archivo_ruta,
  ADD COLUMN tamano_bytes BIGINT NULL AFTER mime_type,
  ADD COLUMN estado_ia ENUM('pendiente','procesando','listo','sin_ia','error') NOT NULL DEFAULT 'pendiente' AFTER contenido_crudo,
  ADD COLUMN descripcion_ia TEXT NULL AFTER estado_ia,
  ADD COLUMN error_ia TEXT NULL AFTER descripcion_ia,
  ADD COLUMN sugerencias LONGTEXT NULL AFTER error_ia,
  ADD COLUMN ia_archivo LONGTEXT NULL AFTER sugerencias;

-- Tipos de fuente: se amplía el ENUM, se mapean los viejos y se deja el nuevo
ALTER TABLE data_sources MODIFY tipo_fuente
  ENUM('planilla','formulario','encuesta','registro_manual','documento','otro','json','pdf','imagen','audio','video','texto')
  NOT NULL DEFAULT 'otro';
UPDATE data_sources SET tipo_fuente = 'planilla' WHERE tipo_fuente IN ('formulario', 'encuesta');
UPDATE data_sources SET tipo_fuente = 'texto' WHERE tipo_fuente = 'registro_manual';
ALTER TABLE data_sources MODIFY tipo_fuente
  ENUM('planilla','json','pdf','imagen','audio','video','documento','texto','otro')
  NOT NULL DEFAULT 'otro';

-- Las fuentes existentes se identifican con IA al iniciar el servidor
UPDATE data_sources SET estado_ia = 'pendiente';

ALTER TABLE reports
  ADD COLUMN titulo VARCHAR(200) NULL AFTER id,
  ADD COLUMN consulta TEXT NULL AFTER titulo,
  ADD COLUMN origen ENUM('ia','local') NOT NULL DEFAULT 'local' AFTER estado,
  ADD COLUMN modelo_ia VARCHAR(80) NULL AFTER origen;
