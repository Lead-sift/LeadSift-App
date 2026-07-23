-- Migración 018: tres canales/producto más — Email funcional (un agente
-- contesta los correos recibidos en la bandeja de la empresa cliente),
-- Instagram Chat y Chat Web (widget embebido en la web del cliente).
--
-- "email" (canal de ingesta genérico ya existente) pasa a llamarse
-- "email_funcional" para encajar con el resto de nombres de producto — es
-- el mismo canal, ahora tratado como uno más con su propia configuración de
-- conexión y pausa en Servicios.

alter table empresa_canales drop constraint if exists empresa_canales_canal_check;

update empresa_canales set canal = 'email_funcional' where canal = 'email';

alter table empresa_canales add constraint empresa_canales_canal_check
  check (canal in (
    'formulario',
    'whatsapp_independiente',
    'whatsapp_coexistence',
    'email_funcional',
    'instagram_chat',
    'chat_web'
  ));
