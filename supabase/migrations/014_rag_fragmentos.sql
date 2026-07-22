-- Migración 014: RAG real para documentos voluminosos (catálogos de marca,
-- listados de clientes existentes). En vez de inyectar el documento entero
-- en cada consulta, se trocea en fragmentos y se recupera solo el más
-- relevante para el mensaje del cliente, vía full-text search de Postgres
-- (sin API externa de embeddings — decisión explícita para no añadir coste
-- ni dependencias nuevas).

create table if not exists documento_fragmentos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos_empresa(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  contenido text not null,
  orden int not null default 0,
  tsv tsvector generated always as (to_tsvector('spanish', contenido)) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_fragmentos_tsv on documento_fragmentos using gin(tsv);
create index if not exists idx_fragmentos_empresa on documento_fragmentos(empresa_id);

alter table documento_fragmentos enable row level security;

create policy fragmentos_lectura on documento_fragmentos
  for select using (es_interno());

create policy fragmentos_gestion on documento_fragmentos
  for all using (es_interno()) with check (es_interno());

-- Recupera los fragmentos más relevantes de una empresa para un texto de
-- consulta dado, ordenados por relevancia (ts_rank). SECURITY DEFINER +
-- search_path fijo, mismo patrón que el resto de funciones del proyecto.
create or replace function buscar_fragmentos(p_empresa_id uuid, p_consulta text, p_limite int default 5)
returns table(id uuid, documento_id uuid, contenido text, rank real)
language sql
security definer
set search_path = public
stable
as $$
  select f.id, f.documento_id, f.contenido,
         ts_rank(f.tsv, websearch_to_tsquery('spanish', p_consulta)) as rank
  from documento_fragmentos f
  where f.empresa_id = p_empresa_id
    and f.tsv @@ websearch_to_tsquery('spanish', p_consulta)
  order by rank desc
  limit p_limite;
$$;
