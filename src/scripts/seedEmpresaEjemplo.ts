import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";
import { empresaEjemplo, construirPromptSistema } from "../prompts/plantillaBase.js";

// Inserta la empresa placeholder en Supabase para poder probar el flujo
// end-to-end. Sustituir por datos reales en cuanto se decida el sector piloto.
async function main() {
  const { data: empresa, error } = await supabase
    .from("empresas")
    .insert({
      nombre: empresaEjemplo.nombre,
      sector: empresaEjemplo.sector,
      tono_comunicacion: empresaEjemplo.tono,
      idioma_principal: "es",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`No se pudo crear la empresa de ejemplo: ${error.message}`);
  }

  const { error: errorPrompt } = await supabase.from("prompts_sistema").insert({
    empresa_id: empresa.id,
    version: 1,
    contenido: construirPromptSistema(empresaEjemplo),
    activo: true,
  });

  if (errorPrompt) {
    throw new Error(`No se pudo crear el prompt de sistema: ${errorPrompt.message}`);
  }

  console.log("Empresa de ejemplo creada. Guarda este id para el test end-to-end:");
  console.log(empresa.id);
}

main();
