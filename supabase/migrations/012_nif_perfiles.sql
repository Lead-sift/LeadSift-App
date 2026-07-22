-- Migración 012: NIF del usuario (persona), no de la empresa. Se usará más
-- adelante para filtrar la información que ve cada usuario externo
-- (client_user) en la futura plataforma de cliente.

alter table perfiles add column if not exists nif text;
