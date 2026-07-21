import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno");
}

// Cliente con permisos de servidor: usado por casi todo el backend, ignora RLS.
export const supabase = createClient(url, serviceRoleKey);

// Cliente con la clave pública (anon): solo para el flujo de login, que debe
// autenticar como lo haría cualquier usuario normal, no como el servidor.
export function crearClienteAnonimo() {
  if (!anonKey) {
    throw new Error("Falta SUPABASE_ANON_KEY en el entorno");
  }
  return createClient(url!, anonKey);
}
