import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";

async function main() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === "catalogo-imagenes")) {
    console.log("El bucket 'catalogo-imagenes' ya existe.");
    return;
  }

  const { error } = await supabase.storage.createBucket("catalogo-imagenes", {
    public: true, // fotos de producto, no sensibles; URL pública simplifica el envío por WhatsApp más adelante
    fileSizeLimit: "10MB",
  });

  if (error) throw new Error(`No se pudo crear el bucket: ${error.message}`);
  console.log("Bucket 'catalogo-imagenes' creado correctamente.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
