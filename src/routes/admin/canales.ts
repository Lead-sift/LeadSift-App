import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";

export const canalesAdminRouter = Router();

canalesAdminRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("empresa_canales")
    .select("*, empresas(nombre)")
    .order("ultima_actividad", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
