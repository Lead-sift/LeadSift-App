import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";
import { empresaEjemplo } from "../prompts/plantillaBase.js";

// Inserta la empresa placeholder en Supabase para poder probar el flujo
// end-to-end. Sustituir por datos reales en cuanto se decida el sector piloto.
async function main() {
  const { data, error } = await supabase
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

  console.log("Empresa de ejemplo creada. Guarda este id para el test end-to-end:");
  console.log(data.id);
}

main();
