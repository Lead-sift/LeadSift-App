import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";

// Borra todos los datos de prueba (empresas y todo lo que cuelga de ellas
// por cascade: prompts, documentos, conversaciones, mensajes, leads).
// Solo para el entorno de pruebas del piloto, nunca ejecutar en producción
// con clientes reales dados de alta.
async function main() {
  const { error } = await supabase
    .from("empresas")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw new Error(`No se pudo limpiar: ${error.message}`);
  }

  console.log("Datos de prueba eliminados.");
}

main();
