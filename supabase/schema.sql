-- Esquema inicial. Ejecutar en el SQL editor de Supabase.

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sector text not null,
  tono_comunicacion text not null default 'cercano',
  idioma_principal text not null default 'es',
  umbral_escalado jsonb not null default '{}'::jsonb,
  canal_config jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Prompts de sistema versionados por empresa. No se sobreescriben: cada
-- cambio crea una fila nueva y se marca la vigente con "activo".
create table if not exists prompts_sistema (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  version int not null,
  contenido text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (empresa_id, version)
);

create table if not exists documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null, -- faq | catalogo | politica_precios | horarios
  contenido text not null,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists conversaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  canal text not null, -- email | formulario | whatsapp
  remitente_contacto text not null,
  estado text not null default 'abierta', -- abierta | escalada | cerrada
  created_at timestamptz not null default now()
);

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  origen text not null, -- cliente | ia | humano
  contenido text not null,
  requiere_aprobacion boolean not null default false,
  aprobado boolean,
  prompt_sistema_id uuid references prompts_sistema(id),
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre_contacto text,
  contacto text,
  necesidad text,
  presupuesto_estimado text,
  urgencia text, -- alta | media | baja
  score text not null default 'frio', -- caliente | templado | frio
  notificado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensajes_conversacion on mensajes(conversacion_id);
create index if not exists idx_conversaciones_empresa on conversaciones(empresa_id);
create index if not exists idx_leads_empresa on leads(empresa_id);
