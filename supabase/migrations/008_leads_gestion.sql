-- Migración 008: campos de gestión de leads sobre conversaciones (resultado,
-- motivo de desestimación, resumen, transferencia a la empresa cliente).
-- El "Estado" (en_curso/congelado/finalizado) y la "Temperatura" no se
-- guardan como columna: se calculan al vuelo a partir de estos datos y de
-- la actividad de la conversación.

alter table conversaciones
  add column if not exists resultado text check (resultado in ('confirmado', 'desestimado', 'spam')),
  add column if not exists motivo_desestimado text,
  add column if not exists resumen text,
  add column if not exists transferido boolean not null default false,
  add column if not exists transferido_en timestamptz;

create index if not exists idx_conversaciones_resultado on conversaciones(resultado);
