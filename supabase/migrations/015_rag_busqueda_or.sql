-- Migración 015: corrige buscar_fragmentos (014_rag_fragmentos.sql).
-- websearch_to_tsquery trata las palabras sueltas como AND (exige que
-- aparezcan todas), así que una frase natural larga del cliente
-- ("hola quería preguntar por la silla Aurora...") no encontraba nada
-- porque el fragmento no contiene "hola" ni "preguntar". Se sustituye por
-- una query OR construida a partir de los lexemas de la consulta: basta con
-- que aparezca cualquier término relevante, y ts_rank sigue ordenando por
-- cuántos/cuáles coinciden.

create or replace function buscar_fragmentos(p_empresa_id uuid, p_consulta text, p_limite int default 5)
returns table(id uuid, documento_id uuid, contenido text, rank real)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_query tsquery;
begin
  select to_tsquery('spanish', string_agg(lexeme, ' | '))
  into v_query
  from unnest(tsvector_to_array(to_tsvector('spanish', p_consulta))) as lexeme;

  if v_query is null then
    return;
  end if;

  return query
  select f.id, f.documento_id, f.contenido, ts_rank(f.tsv, v_query) as rank
  from documento_fragmentos f
  where f.empresa_id = p_empresa_id
    and f.tsv @@ v_query
  order by rank desc
  limit p_limite;
end;
$$;
