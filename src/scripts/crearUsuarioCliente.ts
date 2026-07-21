import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";

// Uso: tsx src/scripts/crearUsuarioCliente.ts <email> <password> <empresaId> [nombre]
async function main() {
  const [email, password, empresaId, nombre] = process.argv.slice(2);
  if (!email || !password || !empresaId) {
    throw new Error("Uso: tsx crearUsuarioCliente.ts <email> <password> <empresaId> [nombre]");
  }

  const { data: usuario, error: errorAuth } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorAuth || !usuario.user) {
    throw new Error(`No se pudo crear el usuario: ${errorAuth?.message}`);
  }

  const { error: errorPerfil } = await supabase.from("perfiles").insert({
    id: usuario.user.id,
    rol: "client_user",
    empresa_id: empresaId,
    nombre: nombre ?? null,
  });

  if (errorPerfil) {
    throw new Error(`No se pudo crear el perfil: ${errorPerfil.message}`);
  }

  console.log(`Usuario cliente creado: ${email} (empresa: ${empresaId})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
