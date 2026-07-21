import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const empresasAdminRouter = Router();

empresasAdminRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

empresasAdminRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Empresa no encontrada" });
  res.json(data);
});

const esquemaEmpresa = z.object({
  nombre: z.string().min(1),
  sector: z.string().min(1),
  tono_comunicacion: z.string().default("cercano"),
  idioma_principal: z.string().default("es"),
  canal_config: z.record(z.unknown()).optional(),
});

empresasAdminRouter.post("/", async (req, res) => {
  const parseo = esquemaEmpresa.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase.from("empresas").insert(parseo.data).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

empresasAdminRouter.put("/:id", async (req, res) => {
  const parseo = esquemaEmpresa.partial().safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("empresas")
    .update(parseo.data)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Baja lógica, no borrado físico: preserva el histórico de conversaciones/leads.
empresasAdminRouter.delete("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("empresas")
    .update({ activo: false })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
