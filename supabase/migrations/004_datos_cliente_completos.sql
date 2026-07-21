-- Migración 004: ficha de cliente completa (identificación fiscal, dirección
-- postal española, contacto y datos comerciales).

alter table empresas
  add column if not exists nif_cif_nie varchar(9),

  -- Dirección postal española desglosada
  add column if not exists tipo_via varchar(30),
  add column if not exists nombre_via varchar(150),
  add column if not exists numero_via varchar(10),
  add column if not exists piso varchar(10),
  add column if not exists puerta varchar(10),
  add column if not exists codigo_postal varchar(5),
  add column if not exists municipio varchar(100),
  add column if not exists provincia varchar(100),

  -- Persona de contacto
  add column if not exists nombre_contacto varchar(150),
  add column if not exists rol_contacto varchar(50),
  add column if not exists email_contacto varchar(150),
  add column if not exists telefono_contacto varchar(20),

  -- Canal de comunicación adicional y dato comercial
  add column if not exists telefono_comunicacion varchar(20),
  add column if not exists facturacion_anual numeric;
