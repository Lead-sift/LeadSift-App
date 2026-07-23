-- Migración 019: pausa por conversación real para el portal de cliente.
-- Cada mensaje entrante crea una fila nueva en "conversaciones" (no hay un
-- hilo persistente), así que "tomar el control de un chat" se modela como
-- pausar el bot para un contacto concreto (mismo remitente) en un canal
-- concreto de una empresa — el bot deja de auto-responder a esa persona
-- hasta que se reanude, sin afectar al resto de contactos del canal.

create table if not exists contactos_pausados (
  empresa_id uuid not null references empresas(id) on delete cascade,
  canal text not null,
  remitente_contacto text not null,
  pausado_en timestamptz not null default now(),
  pausado_por uuid references perfiles(id),
  primary key (empresa_id, canal, remitente_contacto)
);

alter table contactos_pausados enable row level security;

create policy contactos_pausados_lectura on contactos_pausados
  for select using (es_interno() or empresa_id = mi_empresa_id());

create policy contactos_pausados_gestion on contactos_pausados
  for all using (es_interno() or empresa_id = mi_empresa_id())
  with check (es_interno() or empresa_id = mi_empresa_id());
