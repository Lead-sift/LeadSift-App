import { supabase } from "./supabaseClient.js";

// Carga el prompt de sistema vigente de una empresa (el marcado como
// "activo" en prompts_sistema) y le añade los documentos de referencia
// vigentes (catálogo, FAQ, etc.) de documentos_empresa. Se recompone en
// cada consulta entrante, así que un documento nuevo o un prompt editado
// se aplica de inmediato a la siguiente consulta, sin pasos intermedios.
export async function cargarPromptSistemaActivo(empresaId: string): Promise<string> {
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

  const documentos = await cargarDocumentosVigentes(empresaId);
  if (documentos.length === 0) {
    return data.contenido;
  }

  const bloqueDocumentos = documentos
    .map((d) => `--- ${d.tipo} ---\n${d.contenido}`)
    .join("\n\n");

  return `${data.contenido}\n\nDocumentos de referencia adicionales:\n${bloqueDocumentos}`;
}

// Devuelve solo la última versión de cada tipo de documento (tipo = clave:
// catálogo, FAQ, política de precios... cada uno se versiona por separado).
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
    if (!ultimaVersionPorTipo.has(doc.tipo)) {
      ultimaVersionPorTipo.set(doc.tipo, { tipo: doc.tipo, contenido: doc.contenido });
    }
  }
  return [...ultimaVersionPorTipo.values()];
}
