import { supabase } from "./supabaseClient.js";

// Modelo "opt-out": una clave está habilitada salvo que exista una fila
// explícita en portal_permisos con habilitado=false. Catálogo completo de
// claves en src/config/portalFuncionalidades.ts.
export async function tienePermisoPortal(perfilId: string, clave: string): Promise<boolean> {
  const { data } = await supabase
    .from("portal_permisos")
    .select("habilitado")
    .eq("perfil_id", perfilId)
    .eq("clave", clave)
    .maybeSingle();

  return data?.habilitado ?? true;
}
