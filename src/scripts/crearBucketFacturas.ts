import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";

async function main() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === "facturas-clientes")) {
    console.log("El bucket 'facturas-clientes' ya existe.");
    return;
  }

  const { error } = await supabase.storage.createBucket("facturas-clientes", {
    public: false, // facturas: datos económicos y fiscales, nunca públicas
    fileSizeLimit: "5MB",
  });

  if (error) throw new Error(`No se pudo crear el bucket: ${error.message}`);
  console.log("Bucket 'facturas-clientes' creado correctamente.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
