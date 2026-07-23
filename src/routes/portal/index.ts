import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";
import { tienePermisoPortal } from "../../services/portalPermisos.js";
import { portalCanalesRouter } from "./canales.js";
import { portalLeadsRouter } from "./leads.js";
import { portalDocumentosRouter } from "./documentos.js";
import { portalFacturacionRouter } from "./facturacion.js";

export const portalRouter = Router();

// Todas las consultas se filtran por req.perfil.empresa_id (resuelto por el
// middleware requiereClientUser desde la sesión, que ya verifica la golden
// rule del NIF) — nunca por un id que venga del cliente/URL.

portalRouter.get("/resumen", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "resumen.ver"))) {
    return res.status(403).json({ error: "No tienes permiso para ver el resumen" });
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("score, urgencia, created_at")
    .eq("empresa_id", empresaId);

  if (error) return res.status(500).json({ error: error.message });

  const total = leads.length;
  const calientes = leads.filter((l) => l.score === "caliente").length;
  const templados = leads.filter((l) => l.score === "templado").length;
  const frios = leads.filter((l) => l.score === "frio").length;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const leadsEsteMes = leads.filter((l) => new Date(l.created_at) >= inicioMes).length;

  const [{ data: canales }, { data: empresa }, { count: pendientesGestion }] = await Promise.all([
    supabase.from("empresa_canales").select("canal, estado_conexion, pausado").eq("empresa_id", empresaId),
    supabase.from("empresas").select("nombre").eq("id", empresaId).maybeSingle(),
    supabase.from("contactos_pausados").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId),
  ]);

  res.json({
    total,
    calientes,
    templados,
    frios,
    leadsEsteMes,
    canales: canales ?? [],
    empresaNombre: empresa?.nombre ?? null,
    pendientesGestion: pendientesGestion ?? 0,
  });
});

portalRouter.use("/canales", portalCanalesRouter);
portalRouter.use("/leads", portalLeadsRouter);
portalRouter.use("/documentos", portalDocumentosRouter);
portalRouter.use("/facturacion", portalFacturacionRouter);
