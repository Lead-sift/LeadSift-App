import { supabase } from "./supabaseClient.js";

// Carga el prompt de sistema vigente de una empresa (el marcado como
// "activo" en prompts_sistema). Cada cambio de configuración crea una fila
// nueva con versión incremental en vez de sobreescribir, para poder
// depurar qué versión generó qué respuesta.
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

  return data.contenido;
}
