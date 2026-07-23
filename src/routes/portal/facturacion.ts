import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";
import { tienePermisoPortal } from "../../services/portalPermisos.js";

export const portalFacturacionRouter = Router();

// Solo recibos ya emitidos (con factura real generada) — un recibo sin
// emitir es un cálculo interno, no algo que el cliente deba ver todavía.
portalFacturacionRouter.get("/", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "facturacion.ver"))) {
    return res.status(403).json({ error: "No tienes permiso para ver facturación" });
  }

  const { data, error } = await supabase
    .from("recibos")
    .select("id, anio, mes, numero_factura, paquete_nombre, total, emitido_en")
    .eq("empresa_id", empresaId)
    .not("emitido_en", "is", null)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

portalFacturacionRouter.get("/:reciboId/pdf", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "facturacion.descargar"))) {
    return res.status(403).json({ error: "No tienes permiso para descargar facturas" });
  }

  const { data: recibo, error } = await supabase
    .from("recibos")
    .select("pdf_path")
    .eq("id", req.params.reciboId)
    .eq("empresa_id", empresaId) // golden rule: solo sus propias facturas
    .maybeSingle();

  if (error || !recibo?.pdf_path) return res.status(404).json({ error: "Factura no encontrada" });

  const { data, error: errorFirma } = await supabase.storage
    .from("facturas-clientes")
    .createSignedUrl(recibo.pdf_path, 60 * 60);

  if (errorFirma || !data) return res.status(500).json({ error: errorFirma?.message ?? "No se pudo generar el enlace" });
  res.json({ url: data.signedUrl });
});
