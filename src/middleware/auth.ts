import type { NextFunction, Request, Response } from "express";
import { supabase } from "../services/supabaseClient.js";
import { ROLES_INTERNOS, type Perfil, type Rol } from "../types/perfil.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      perfil?: Perfil;
    }
  }
}

// Verifica el JWT de Supabase Auth del header Authorization: Bearer <token>,
// carga el perfil (rol + empresa_id) y lo adjunta a la request. Nunca confía
// en un empresaId que venga del propio request — siempre se resuelve aquí,
// desde la sesión autenticada.
async function autenticar(req: Request, res: Response): Promise<Perfil | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Falta el token de autenticación" });
    return null;
  }

  const { data: userData, error: errorAuth } = await supabase.auth.getUser(token);
  if (errorAuth || !userData.user) {
    res.status(401).json({ error: "Token inválido o caducado" });
    return null;
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("id, rol, empresa_id, nombre")
    .eq("id", userData.user.id)
    .single();

  if (errorPerfil || !perfil) {
    res.status(403).json({ error: "Usuario sin perfil asignado" });
    return null;
  }

  return perfil as Perfil;
}

export function requiereRol(...rolesPermitidos: Rol[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const perfil = await autenticar(req, res);
    if (!perfil) return; // autenticar() ya envió la respuesta de error

    if (!rolesPermitidos.includes(perfil.rol)) {
      return res.status(403).json({ error: "No tienes permiso para acceder a este recurso" });
    }

    req.perfil = perfil;
    next();
  };
}

export const requiereInterno = requiereRol(...ROLES_INTERNOS);
export const requiereClientUser = requiereRol("client_user");
