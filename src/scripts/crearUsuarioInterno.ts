import "dotenv/config";
import { supabase } from "../services/supabaseClient.js";

// Uso: tsx src/scripts/crearUsuarioInterno.ts <email> <password> <rol> [nombre]
// rol: owner | admin | soporte
async function main() {
  const [email, password, rol, nombre] = process.argv.slice(2);
  if (!email || !password || !rol) {
    throw new Error("Uso: tsx crearUsuarioInterno.ts <email> <password> <rol> [nombre]");
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
    rol,
    nombre: nombre ?? null,
  });

  if (errorPerfil) {
    throw new Error(`No se pudo crear el perfil: ${errorPerfil.message}`);
  }

  console.log(`Usuario interno creado: ${email} (rol: ${rol})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
