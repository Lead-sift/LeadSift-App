import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";

export const consultasAdminRouter = Router();

// Vista "Consultas Generales": todas las conversaciones de todas las
// empresas, con sus leads asociados, filtrables desde un único listado.
consultasAdminRouter.get("/", async (req, res) => {
  const { empresaId, canal, intencion, desde, hasta, limite } = req.query;

  let consulta = supabase
    .from("conversaciones")
    .select("id, empresa_id, canal, intencion, estado, remitente_contacto, created_at, empresas(nombre), leads(necesidad, urgencia, score, contacto)")
    .order("created_at", { ascending: false })
    .limit(limite ? Number(limite) : 100);

  if (empresaId) consulta = consulta.eq("empresa_id", empresaId as string);
  if (canal) consulta = consulta.eq("canal", canal as string);
  if (intencion) consulta = consulta.eq("intencion", intencion as string);
  if (desde) consulta = consulta.gte("created_at", desde as string);
  if (hasta) consulta = consulta.lte("created_at", hasta as string);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
