-- Migración 011: identificador de factura, emisión en PDF y envío por email
-- para cada recibo (supabase/migrations/010_facturacion.sql).

alter table recibos add column if not exists numero_factura text unique;
alter table recibos add column if not exists pdf_path text; -- ruta dentro del bucket de Storage
alter table recibos add column if not exists emitido_en timestamptz;
alter table recibos add column if not exists enviado_en timestamptz;

create sequence if not exists numeros_factura_seq start 1;

-- Genera el siguiente número de factura de forma atómica (evita duplicados
-- por condiciones de carrera entre dos emisiones simultáneas).
create or replace function siguiente_numero_factura()
returns text
language sql
security definer
set search_path = public
as $$
  select 'F-' || lpad(nextval('numeros_factura_seq')::text, 6, '0');
$$;
