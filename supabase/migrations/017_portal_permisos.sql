-- Migración 017: preparación del portal de agente (cliente externo).
-- Todavía no se construye el portal en sí — esto guarda, por usuario
-- externo (client_user), qué pestañas/acciones de ese futuro portal tiene
-- habilitadas, para que el equipo interno pueda perfilarlo desde ya en
-- Usuarios/Roles. El catálogo de claves posibles vive en el código
-- (src/config/portalFuncionalidades.ts), no en esta tabla.
--
-- Modelo "opt-out": si no hay fila para una clave, se considera habilitada
-- por defecto. Una fila con habilitado=false la desactiva explícitamente.

create table if not exists portal_permisos (
  perfil_id uuid not null references perfiles(id) on delete cascade,
  clave text not null,
  habilitado boolean not null default true,
  actualizado_en timestamptz not null default now(),
  primary key (perfil_id, clave)
);

alter table portal_permisos enable row level security;

create policy portal_permisos_lectura on portal_permisos
  for select using (es_interno() or perfil_id = auth.uid());

create policy portal_permisos_gestion on portal_permisos
  for all using (es_interno()) with check (es_interno());
