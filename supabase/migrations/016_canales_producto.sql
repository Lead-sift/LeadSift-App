-- Migración 016: tres canales/producto explícitos (antes "whatsapp" era un
-- único canal ambiguo) y pausa por canal y por cliente.
--
-- Productos/canales accionables: Formulario web, WhatsApp bot independiente
-- (número nuevo, dedicado a captación, gestionado 100% por nuestra Cloud
-- API) y WhatsApp bot Coexistence (número existente del cliente, que sigue
-- siendo usable desde la app de WhatsApp Business gracias a la función de
-- coexistencia de Meta). "email" se mantiene como canal de ingesta genérico
-- (leads reenviados por correo), pero no es uno de los tres productos.

alter table empresa_canales drop constraint if exists empresa_canales_canal_check;

update empresa_canales set canal = 'whatsapp_independiente' where canal = 'whatsapp';

alter table empresa_canales add constraint empresa_canales_canal_check
  check (canal in ('formulario', 'whatsapp_independiente', 'whatsapp_coexistence', 'email'));

-- Pausa manual del bot para ese canal y cliente: el bot deja de responder
-- automáticamente (aunque se sigue clasificando/registrando el lead para
-- que quede visible y alguien lo atienda a mano), sin tocar ni desconectar
-- las credenciales del canal.
alter table empresa_canales add column if not exists pausado boolean not null default false;
alter table empresa_canales add column if not exists pausado_en timestamptz;
alter table empresa_canales add column if not exists pausado_por uuid references perfiles(id);
