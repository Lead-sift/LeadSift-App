-- Migración 003: guardar la intención detectada por conversación, necesaria
-- para los KPIs de distribución de tipo de consulta (spam/informativa/lead/disponibilidad).

alter table conversaciones add column if not exists intencion text
  check (intencion in ('spam', 'informativa', 'lead_potencial', 'consulta_disponibilidad'));
