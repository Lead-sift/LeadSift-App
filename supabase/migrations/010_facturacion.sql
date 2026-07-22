-- Migración 010: sistema de facturación. Añade la cuenta de facturación del
-- cliente (para cuando se conecte el banco más adelante) y una tabla de
-- recibos mensuales generados automáticamente a partir del paquete asignado
-- (supabase/migrations/009_paquetes.sql) y el recuento real de leads del mes.

alter table empresas add column if not exists cuenta_facturacion text; -- IBAN u otra referencia bancaria

-- Un recibo por empresa y mes. Se genera como una fotografía (snapshot) de
-- los datos del paquete en ese momento, para que cambios futuros en el
-- paquete no alteren recibos ya emitidos.
create table if not exists recibos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  anio int not null,
  mes int not null check (mes between 1 and 12),

  paquete_id uuid references paquetes(id),
  paquete_nombre text,
  metodo_facturacion text,

  coste_implementacion numeric not null default 0,
  incluye_implementacion boolean not null default false, -- solo en el primer recibo de la empresa

  precio_por_lead numeric,
  coste_mensual numeric,
  leads_incluidos_mes int,
  precio_lead_adicional numeric,

  leads_contados int not null default 0,
  leads_exceso int not null default 0,
  total numeric not null default 0,

  generado_en timestamptz not null default now(),
  unique (empresa_id, anio, mes)
);

create index if not exists idx_recibos_anio_mes on recibos(anio, mes);

alter table recibos enable row level security;

create policy recibos_lectura on recibos
  for select using (es_interno() or empresa_id = mi_empresa_id());

create policy recibos_gestion on recibos
  for all using (es_interno()) with check (es_interno());
