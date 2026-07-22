import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const usuariosAdminRouter = Router();

const ROLES = ["owner", "admin", "soporte", "client_user"] as const;

usuariosAdminRouter.get("/", async (_req, res) => {
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("*, empresas(nombre)")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) return res.status(500).json({ error: authError.message });

  const mapaEmail = new Map(authData.users.map((u) => [u.id, u.email]));

  res.json(
    (perfiles ?? []).map((p) => ({
      ...p,
      email: mapaEmail.get(p.id) ?? null,
      empresaNombre: (p as any).empresas?.nombre ?? null,
    }))
  );
});

const esquemaCrear = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rol: z.enum(ROLES),
  nombre: z.string().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
});

usuariosAdminRouter.post("/", async (req, res) => {
  const parseo = esquemaCrear.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { email, password, rol, nombre, empresaId } = parseo.data;
  if (rol === "client_user" && !empresaId) {
    return res.status(400).json({ error: "Un usuario externo (client_user) requiere una empresa asignada" });
  }

  const { data: usuario, error: errorAuth } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errorAuth || !usuario.user) {
    return res.status(500).json({ error: errorAuth?.message ?? "No se pudo crear el usuario" });
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .insert({
      id: usuario.user.id,
      rol,
      nombre: nombre ?? null,
      empresa_id: rol === "client_user" ? empresaId : null,
    })
    .select()
    .single();

  if (errorPerfil) {
    // Revierte el usuario de Auth si no se pudo crear el perfil, para no
    // dejar una cuenta huérfana sin rol asignado.
    await supabase.auth.admin.deleteUser(usuario.user.id);
    return res.status(500).json({ error: errorPerfil.message });
  }

  res.status(201).json({ ...perfil, email });
});

const esquemaActualizar = z.object({
  rol: z.enum(ROLES).optional(),
  nombre: z.string().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
});

usuariosAdminRouter.put("/:id", async (req, res) => {
  const parseo = esquemaActualizar.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const actualizacion: Record<string, unknown> = {};
  if (parseo.data.rol !== undefined) actualizacion.rol = parseo.data.rol;
  if (parseo.data.nombre !== undefined) actualizacion.nombre = parseo.data.nombre;
  if (parseo.data.empresaId !== undefined) actualizacion.empresa_id = parseo.data.empresaId;

  if (actualizacion.rol && actualizacion.rol !== "client_user") actualizacion.empresa_id = null;

  const { data, error } = await supabase
    .from("perfiles")
    .update(actualizacion)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const esquemaPassword = z.object({ password: z.string().min(8) });

usuariosAdminRouter.put("/:id/password", async (req, res) => {
  const parseo = esquemaPassword.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { error } = await supabase.auth.admin.updateUserById(req.params.id, { password: parseo.data.password });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

usuariosAdminRouter.delete("/:id", async (req, res) => {
  if (req.perfil?.id === req.params.id) {
    return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
  }

  await supabase.from("perfiles").delete().eq("id", req.params.id);
  const { error } = await supabase.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
