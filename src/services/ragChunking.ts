import { supabase } from "./supabaseClient.js";

// Solo los tipos de documento voluminosos pasan por RAG (troceado +
// recuperación por relevancia). Los demás (FAQ, política de precios,
// horarios, otro) son pequeños y se siguen inyectando enteros: trocearlos
// no ahorraría tokens y complicaría la respuesta sin necesidad.
const TIPOS_RAG = ["catalogo", "listado_clientes"];

export function requiereRag(tipo: string): boolean {
  return TIPOS_RAG.includes(tipo);
}

// Trocea por párrafos (separados por línea en blanco) y los agrupa hasta un
// tamaño objetivo, para no cortar productos/entradas a la mitad cuando el
// documento ya viene con esa estructura (catálogos, listados de clientes).
export function trocearTexto(contenido: string, tamanoObjetivo = 1000): string[] {
  const parrafos = contenido
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parrafos.length === 0) return contenido.trim() ? [contenido.trim()] : [];

  const trozos: string[] = [];
  let actual = "";
  for (const parrafo of parrafos) {
    if (actual && actual.length + parrafo.length > tamanoObjetivo) {
      trozos.push(actual.trim());
      actual = "";
    }
    actual += (actual ? "\n\n" : "") + parrafo;
  }
  if (actual.trim()) trozos.push(actual.trim());

  return trozos;
}

// Regenera los fragmentos de búsqueda de un documento recién guardado. Borra
// los fragmentos de versiones anteriores del mismo tipo para esa empresa
// (documentos_empresa no se sobreescribe, así que sin esto se acumularían
// fragmentos de catálogos ya desactualizados mezclados en la búsqueda).
export async function regenerarFragmentos(
  empresaId: string,
  documentoId: string,
  tipo: string,
  contenido: string
) {
  if (!requiereRag(tipo)) return;

  const { data: documentosAnteriores } = await supabase
    .from("documentos_empresa")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .neq("id", documentoId);

  const idsAnteriores = (documentosAnteriores ?? []).map((d) => d.id);
  if (idsAnteriores.length > 0) {
    await supabase.from("documento_fragmentos").delete().in("documento_id", idsAnteriores);
  }

  const trozos = trocearTexto(contenido);
  if (trozos.length === 0) return;

  const filas = trozos.map((texto, indice) => ({
    documento_id: documentoId,
    empresa_id: empresaId,
    contenido: texto,
    orden: indice,
  }));

  const { error } = await supabase.from("documento_fragmentos").insert(filas);
  if (error) {
    console.error("Error generando fragmentos RAG:", error);
  }
}
