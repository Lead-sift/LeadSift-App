-- Migración 007: catálogo de imágenes extraídas de PDF/Word, con
-- etiquetado manual (nombre/descripción de producto) por parte del admin.

create table if not exists imagenes_catalogo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  documento_origen text not null, -- nombre del archivo PDF/Word subido
  pagina int, -- número de página (PDF); null si viene de Word
  ruta_storage text not null, -- ruta dentro del bucket catalogo-imagenes
  url_publica text not null,
  etiqueta text, -- nombre/descripción del producto, puesta manualmente
  created_at timestamptz not null default now()
);

create index if not exists idx_imagenes_catalogo_empresa on imagenes_catalogo(empresa_id);

alter table imagenes_catalogo enable row level security;

create policy imagenes_catalogo_select on imagenes_catalogo
  for select using (es_interno() or empresa_id = mi_empresa_id());

create policy imagenes_catalogo_gestion on imagenes_catalogo
  for all using (es_interno()) with check (es_interno());
