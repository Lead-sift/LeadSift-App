-- Migración 005: código de cliente legible (A0000001, A0000002...) además
-- del uuid interno. El uuid sigue siendo la clave real de todas las
-- relaciones; este código es solo para mostrar y buscar en la interfaz.

create sequence if not exists empresas_codigo_seq start 1;

alter table empresas add column if not exists codigo_cliente text unique;

create or replace function generar_codigo_cliente()
returns trigger
language plpgsql
as $$
begin
  if new.codigo_cliente is null then
    new.codigo_cliente := 'A' || lpad(nextval('empresas_codigo_seq')::text, 7, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_codigo_cliente on empresas;
create trigger trg_codigo_cliente
  before insert on empresas
  for each row execute function generar_codigo_cliente();

-- Rellenar el código a las empresas ya existentes que no lo tengan.
update empresas
set codigo_cliente = 'A' || lpad(nextval('empresas_codigo_seq')::text, 7, '0')
where codigo_cliente is null;
