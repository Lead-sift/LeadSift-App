-- Migración 006: fecha de activación del prompt, distinta de la fecha de
-- creación (una versión se puede crear en sandbox y activarse más tarde).

alter table prompts_sistema add column if not exists activado_en timestamptz;

-- Las versiones ya activas hoy no tienen fecha de activación registrada;
-- se asume que se activaron cuando se crearon, como aproximación razonable.
update prompts_sistema set activado_en = created_at where activo = true and activado_en is null;
