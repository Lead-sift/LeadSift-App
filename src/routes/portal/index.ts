import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";

export const portalRouter = Router();

// Todas las consultas se filtran por req.perfil.empresa_id (resuelto por el
// middleware requiereClientUser desde la sesión) — nunca por un id que venga
// del cliente/URL, precisamente para que no se pueda manipular.

portalRouter.get("/resumen", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  const { data: leads, error } = await supabase
    .from("leads")
    .select("score, urgencia, created_at")
    .eq("empresa_id", empresaId);

  if (error) return res.status(500).json({ error: error.message });

  const total = leads.length;
  const calientes = leads.filter((l) => l.score === "caliente").length;
  const templados = leads.filter((l) => l.score === "templado").length;
  const frios = leads.filter((l) => l.score === "frio").length;

  res.json({ total, calientes, templados, frios });
});

portalRouter.get("/consultas", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  const { canal, desde, hasta } = req.query;

  let consulta = supabase
    .from("conversaciones")
    .select("id, canal, remitente_contacto, estado, created_at, leads(score, necesidad, urgencia, contacto)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (canal) consulta = consulta.eq("canal", canal as string);
  if (desde) consulta = consulta.gte("created_at", desde as string);
  if (hasta) consulta = consulta.lte("created_at", hasta as string);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
