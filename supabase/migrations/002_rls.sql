-- Migración 002: Row Level Security para aislamiento multi-tenant.
-- Ejecutar DESPUÉS de 001_multi_tenant.sql.
--
-- El backend actual (Express) usa la service_role key, que ignora RLS por
-- diseño de Supabase — así que estas políticas no cambian el comportamiento
-- de lo ya construido. Son la capa de defensa en profundidad para cuando el
-- portal cliente consulte Supabase directamente con la sesión del usuario
-- (o para cualquier acceso futuro que no pase por el backend).

-- === Funciones auxiliares ====================================================
-- SECURITY DEFINER + search_path fijo: evita que las políticas sobre
-- `perfiles` entren en recursión al consultarse a sí mismas, y evita
-- inyección de search_path.

create or replace function es_interno()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol in ('owner', 'admin', 'soporte')
  );
$$;

create or replace function mi_empresa_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select empresa_id from perfiles where perfiles.id = auth.uid();
$$;

-- === perfiles ================================================================

alter table perfiles enable row level security;

create policy perfiles_select on perfiles
  for select using (es_interno() or id = auth.uid());

create policy perfiles_insert on perfiles
  for insert with check (es_interno());

create policy perfiles_update on perfiles
  for update using (es_interno() or id = auth.uid());

create policy perfiles_delete on perfiles
  for delete using (es_interno());

-- === Tablas con empresa_id directo ===========================================
-- Mismo patrón para todas: interno ve todo, client_user solo su empresa.

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'empresas', 'documentos_empresa', 'conversaciones', 'mensajes', 'leads',
    'empresa_productos', 'empresa_canales', 'empresa_planes',
    'consumo_tokens', 'feedback_respuestas', 'notificaciones_config'
  ]
  loop
    execute format('alter table %I enable row level security', tabla);

    -- La tabla "empresas" se filtra por su propio id, no por una columna empresa_id.
    if tabla = 'empresas' then
      execute format(
        'create policy %I on %I for select using (es_interno() or id = mi_empresa_id())',
        tabla || '_select', tabla
      );
      execute format(
        'create policy %I on %I for all using (es_interno()) with check (es_interno())',
        tabla || '_gestion', tabla
      );
    else
      execute format(
        'create policy %I on %I for select using (es_interno() or empresa_id = mi_empresa_id())',
        tabla || '_select', tabla
      );
      execute format(
        'create policy %I on %I for all using (es_interno()) with check (es_interno())',
        tabla || '_gestion', tabla
      );
    end if;
  end loop;
end $$;

-- === prompts_sistema ==========================================================
-- Solo el equipo interno gestiona prompts; el cliente nunca necesita leerlos
-- directamente (los ve reflejado en el comportamiento del servicio, no en crudo).

alter table prompts_sistema enable row level security;

create policy prompts_sistema_interno on prompts_sistema
  for all using (es_interno()) with check (es_interno());

-- === productos y planes (catálogo global, no por empresa) ===================

alter table productos enable row level security;
alter table planes enable row level security;

create policy productos_lectura on productos
  for select using (true); -- catálogo público de servicios, visible para cualquier usuario autenticado

create policy productos_gestion on productos
  for all using (es_interno()) with check (es_interno());

create policy planes_lectura on planes
  for select using (true);

create policy planes_gestion on planes
  for all using (es_interno()) with check (es_interno());
