-- Migración 009: paquetes de servicio (Básico/Profesional/Premium) con
-- configuración general (coste de implementación, método de facturación,
-- precios, servicios incluidos) y una asignación por empresa que permite
-- sobrescribir cualquiera de esos valores solo para ese cliente concreto.

create table if not exists paquetes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,

  coste_implementacion numeric not null default 0,

  -- 'lead': se cobra un precio fijo por cada lead cualificado.
  -- 'suscripcion': cuota mensual con un número de leads incluidos y un
  -- precio por cada lead adicional que se exceda de ese cupo.
  metodo_facturacion text not null check (metodo_facturacion in ('lead', 'suscripcion')),
  precio_por_lead numeric,
  leads_incluidos_mes int,
  coste_mensual numeric,
  precio_lead_adicional numeric,

  -- Checklist de servicios incluidos, p.ej. { "formulario": true,
  -- "whatsapp": true, "catalogo_fotos": false, "resumen_ia": true }.
  -- El prompt personalizado no está aquí: es la base para todos los
  -- paquetes, no un diferenciador.
  servicios_incluidos jsonb not null default '{}'::jsonb,

  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un único paquete activo por empresa. "override" guarda solo las claves
-- que ese cliente concreto sobrescribe (coste_implementacion,
-- precio_por_lead, leads_incluidos_mes, coste_mensual,
-- precio_lead_adicional); cualquier clave ausente hereda el valor general
-- del paquete.
create table if not exists empresa_paquete (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  paquete_id uuid references paquetes(id),
  override jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

-- RLS igual que el resto del catálogo (productos/planes): el backend usa
-- service_role y no se ve afectado; esto es defensa en profundidad para
-- cualquier acceso futuro directo desde el portal cliente.
alter table paquetes enable row level security;
alter table empresa_paquete enable row level security;

create policy paquetes_lectura on paquetes
  for select using (true);

create policy paquetes_gestion on paquetes
  for all using (es_interno()) with check (es_interno());

create policy empresa_paquete_lectura on empresa_paquete
  for select using (es_interno() or empresa_id = mi_empresa_id());

create policy empresa_paquete_gestion on empresa_paquete
  for all using (es_interno()) with check (es_interno());
