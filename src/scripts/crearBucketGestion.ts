import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";

async function main() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === "gestion-clientes")) {
    console.log("El bucket 'gestion-clientes' ya existe.");
    return;
  }

  const { error } = await supabase.storage.createBucket("gestion-clientes", {
    public: false, // contratos, LOPD, documentos bancarios: nunca públicos
    fileSizeLimit: "20MB",
  });

  if (error) throw new Error(`No se pudo crear el bucket: ${error.message}`);
  console.log("Bucket 'gestion-clientes' creado correctamente.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
