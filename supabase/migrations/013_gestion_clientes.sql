-- Migración 013: Ficha de Gestión — traza de documentos y notas por cliente
-- (contratos, LOPD, facturas, otros) más los logs automáticos que genera el
-- propio sistema (cambios de datos, cambios de cuenta bancaria, facturas
-- emitidas). También añade el email de envío de datos de facturación.

alter table empresas add column if not exists email_facturacion text;

create table if not exists gestion_entradas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,

  -- Catálogo de categorías: Factura, Contrato, Contrato cesión datos
  -- personales (LOPD) y Otros. Los logs automáticos del sistema usan
  -- 'factura' (facturas emitidas) u 'otros' (cambios de datos/cuenta).
  categoria text not null check (categoria in ('factura', 'contrato', 'contrato_lopd', 'otros')),
  automatico boolean not null default false, -- true = generado por el sistema, false = añadido a mano

  titulo text not null,
  descripcion text,

  -- Documento adjunto opcional. archivo_bucket permite referenciar tanto el
  -- repositorio general de gestión como el de facturas ya emitidas, sin
  -- duplicar el PDF de la factura en dos sitios.
  archivo_bucket text check (archivo_bucket in ('gestion-clientes', 'facturas-clientes')),
  archivo_path text,
  archivo_nombre text,

  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_gestion_entradas_empresa on gestion_entradas(empresa_id, created_at desc);

alter table gestion_entradas enable row level security;

create policy gestion_entradas_lectura on gestion_entradas
  for select using (es_interno());

create policy gestion_entradas_gestion on gestion_entradas
  for all using (es_interno()) with check (es_interno());
