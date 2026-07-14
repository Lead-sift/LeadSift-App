import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";
import { espaiLaLira, construirPromptSistema } from "../prompts/plantillaBase.js";

async function main() {
  const { data: empresa, error } = await supabase
    .from("empresas")
    .insert({
      nombre: espaiLaLira.nombre,
      sector: espaiLaLira.sector,
      tono_comunicacion: espaiLaLira.tono,
      idioma_principal: "ca/es",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`No se pudo crear Espai la Lira: ${error.message}`);
  }

  const { error: errorPrompt } = await supabase.from("prompts_sistema").insert({
    empresa_id: empresa.id,
    version: 1,
    contenido: construirPromptSistema(espaiLaLira),
    activo: true,
  });

  if (errorPrompt) {
    throw new Error(`No se pudo crear el prompt de sistema: ${errorPrompt.message}`);
  }

  console.log("Espai la Lira creada. Guarda este id:");
  console.log(empresa.id);
}

main();
