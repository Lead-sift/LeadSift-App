import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";
import { espaiLaLira } from "../prompts/plantillaBase.js";

async function main() {
  const { data, error } = await supabase
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

  console.log("Espai la Lira creada. Guarda este id:");
  console.log(data.id);
}

main();
