import { Router } from "express";
import { z } from "zod";
import { crearClienteAnonimo, supabase } from "../services/supabaseClient.js";

export const authRouter = Router();

const esquemaLogin = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// El navegador nunca habla directamente con Supabase (evita tener que abrir
// la política de seguridad a dominios externos): el backend hace de
// intermediario del login y devuelve el token de sesión al frontend.
authRouter.post("/login", async (req, res) => {
  const parseo = esquemaLogin.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const clienteAnonimo = crearClienteAnonimo();
  const { data, error } = await clienteAnonimo.auth.signInWithPassword(parseo.data);

  if (error || !data.session) {
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, rol, empresa_id, nombre")
    .eq("id", data.user.id)
    .single();

  res.json({ accessToken: data.session.access_token, perfil });
});
