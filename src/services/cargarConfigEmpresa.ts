import { supabase } from "./supabaseClient.js";
import { requiereRag } from "./ragChunking.js";

const FRAGMENTOS_POR_CONSULTA = 5;

// Carga el prompt de sistema vigente de una empresa (el marcado como
// "activo" en prompts_sistema) y le añade los documentos de referencia
// vigentes (FAQ, política de precios, horarios...) enteros, más los
// fragmentos más relevantes para este mensaje concreto de los documentos
// voluminosos (catálogos, listado de clientes) — RAG real vía full-text
// search, en vez de inyectar esos documentos completos en cada consulta.
// Se recompone en cada consulta entrante, así que un documento nuevo o un
// prompt editado se aplica de inmediato a la siguiente consulta.
export async function cargarPromptSistemaActivo(empresaId: string, mensajeTexto: string): Promise<string> {
  const { data, error } = await supabase
    .from("prompts_sistema")
    .select("contenido")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el prompt de sistema: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      `No hay ningún prompt de sistema activo para la empresa ${empresaId}. ` +
        `¿Se ha ejecutado el script de seed correspondiente?`
    );
  }

  const [documentosVigentes, fragmentosRelevantes] = await Promise.all([
    cargarDocumentosVigentes(empresaId),
    buscarFragmentosRelevantes(empresaId, mensajeTexto),
  ]);

  const bloques: string[] = [];
  if (documentosVigentes.length > 0) {
    bloques.push(
      documentosVigentes.map((d) => `--- ${d.tipo} ---\n${d.contenido}`).join("\n\n")
    );
  }
  if (fragmentosRelevantes.length > 0) {
    bloques.push(
      "Fragmentos relevantes de catálogo/listado de clientes para esta consulta:\n" +
        fragmentosRelevantes.map((f) => `- ${f}`).join("\n\n")
    );
  }

  if (bloques.length === 0) {
    return data.contenido;
  }

  return `${data.contenido}\n\nDocumentos de referencia adicionales:\n${bloques.join("\n\n")}`;
}

// Documentos que se inyectan enteros (todo menos catálogo/listado de
// clientes, que van por RAG). Devuelve solo la última versión de cada tipo.
async function cargarDocumentosVigentes(empresaId: string) {
  const { data, error } = await supabase
    .from("documentos_empresa")
    .select("tipo, contenido, version")
    .eq("empresa_id", empresaId)
    .order("version", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron cargar los documentos de la empresa: ${error.message}`);
  }

  const ultimaVersionPorTipo = new Map<string, { tipo: string; contenido: string }>();
  for (const doc of data ?? []) {
    if (requiereRag(doc.tipo)) continue;
    if (!ultimaVersionPorTipo.has(doc.tipo)) {
      ultimaVersionPorTipo.set(doc.tipo, { tipo: doc.tipo, contenido: doc.contenido });
    }
  }
  return [...ultimaVersionPorTipo.values()];
}

// RAG real: recupera solo los fragmentos de catálogo/listado de clientes
// relevantes para el mensaje del cliente, en vez de todo el documento.
async function buscarFragmentosRelevantes(empresaId: string, mensajeTexto: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("buscar_fragmentos", {
    p_empresa_id: empresaId,
    p_consulta: mensajeTexto,
    p_limite: FRAGMENTOS_POR_CONSULTA,
  });

  if (error) {
    // Un fallo en la búsqueda de fragmentos no debe romper la respuesta al
    // cliente: simplemente se responde sin ese contexto adicional.
    console.error("Error buscando fragmentos RAG:", error);
    return [];
  }

  return (data ?? []).map((f: { contenido: string }) => f.contenido);
}
