-- Migración 001: modelo multi-tenant para el dashboard propietario/portal cliente.
-- Ejecutar en el SQL editor de Supabase, DESPUÉS de supabase/schema.sql.

-- === Identidad y roles ===================================================

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('owner', 'admin', 'soporte', 'client_user')),
  empresa_id uuid references empresas(id), -- solo relevante si rol = client_user
  nombre text,
  created_at timestamptz not null default now()
);

-- === Cambios sobre tablas existentes ======================================

-- Denormalizado para que las políticas RLS de mensajes no dependan de un
-- join a través de conversaciones (patrón recomendado por Supabase para RLS).
alter table mensajes add column if not exists empresa_id uuid references empresas(id);

update mensajes m
set empresa_id = c.empresa_id
from conversaciones c
where m.conversacion_id = c.id
  and m.empresa_id is null;

alter table prompts_sistema add column if not exists creado_por uuid references perfiles(id);
alter table prompts_sistema add column if not exists entorno text not null default 'produccion'
  check (entorno in ('sandbox', 'produccion'));

-- === Productos y contratación ==============================================

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio_base numeric,
  activo boolean not null default true
);

create table if not exists empresa_productos (
  empresa_id uuid not null references empresas(id) on delete cascade,
  producto_id uuid not null references productos(id),
  fecha_contratacion date not null default current_date,
  estado text not null default 'activo',
  primary key (empresa_id, producto_id)
);

-- === Canales por cliente (estado de conexión) ==============================

create table if not exists empresa_canales (
  empresa_id uuid not null references empresas(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'formulario', 'email', 'instagram')),
  estado_conexion text not null default 'desconectado'
    check (estado_conexion in ('conectado', 'desconectado', 'error')),
  ultima_actividad timestamptz,
  detalles jsonb not null default '{}'::jsonb,
  primary key (empresa_id, canal)
);

-- === Planes y límites de uso ================================================

create table if not exists planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  limite_consultas_mes int,
  limite_tokens_mes bigint,
  precio numeric
);

create table if not exists empresa_planes (
  empresa_id uuid not null references empresas(id) on delete cascade,
  plan_id uuid not null references planes(id),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  primary key (empresa_id, fecha_inicio)
);

-- === Consumo de tokens (KPIs y facturación) =================================

create table if not exists consumo_tokens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  mensaje_id uuid references mensajes(id),
  modelo text not null, -- haiku | sonnet
  tokens_entrada int not null,
  tokens_salida int not null,
  costo_estimado numeric,
  created_at timestamptz not null default now()
);

-- === Feedback del cliente sobre respuestas concretas =========================

create table if not exists feedback_respuestas (
  id uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references mensajes(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid references perfiles(id),
  correcto boolean not null,
  comentario text,
  created_at timestamptz not null default now()
);

-- === Notificaciones configurables por cliente ================================

create table if not exists notificaciones_config (
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo_evento text not null, -- lead_caliente | resumen_diario
  canal text not null default 'email',
  activo boolean not null default true,
  primary key (empresa_id, tipo_evento)
);

-- === Índices ==================================================================

create index if not exists idx_mensajes_empresa on mensajes(empresa_id);
create index if not exists idx_consumo_tokens_empresa on consumo_tokens(empresa_id);
create index if not exists idx_feedback_empresa on feedback_respuestas(empresa_id);
create index if not exists idx_perfiles_empresa on perfiles(empresa_id);
