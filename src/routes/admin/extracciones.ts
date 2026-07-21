import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";

export const extraccionesAdminRouter = Router();

function aCsv(filas: string[][]): string {
  return filas
    .map((fila) => fila.map((valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

// Extracción de leads (con contexto de empresa/conversación) en CSV o JSON,
// filtrable por empresa y rango de fechas — para análisis fuera de la app.
extraccionesAdminRouter.get("/leads", async (req, res) => {
  const { empresaId, desde, hasta, formato } = req.query;

  let consulta = supabase
    .from("leads")
    .select("created_at, score, urgencia, necesidad, contacto, presupuesto_estimado, empresas(nombre), conversaciones(canal, remitente_contacto)")
    .order("created_at", { ascending: false });

  if (empresaId) consulta = consulta.eq("empresa_id", empresaId as string);
  if (desde) consulta = consulta.gte("created_at", desde as string);
  if (hasta) consulta = consulta.lte("created_at", hasta as string);

  const { data, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  if (formato === "csv") {
    const filas = [
      ["Fecha", "Empresa", "Canal", "Contacto", "Necesidad", "Urgencia", "Score", "Presupuesto"],
      ...(data ?? []).map((l: any) => [
        l.created_at,
        l.empresas?.nombre ?? "",
        l.conversaciones?.canal ?? "",
        l.contacto ?? l.conversaciones?.remitente_contacto ?? "",
        l.necesidad ?? "",
        l.urgencia ?? "",
        l.score,
        l.presupuesto_estimado ?? "",
      ]),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=leads-leadsift.csv");
    return res.send(aCsv(filas));
  }

  res.json(data);
});
