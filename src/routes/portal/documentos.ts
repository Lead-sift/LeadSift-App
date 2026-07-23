import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";
import { tienePermisoPortal } from "../../services/portalPermisos.js";

export const portalDocumentosRouter = Router();

// Solo lectura: el cliente ve su propia Ficha de Gestión (contratos, LOPD,
// facturas, otros), nunca añade ni borra entradas desde aquí.
portalDocumentosRouter.get("/", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "documentos.ver"))) {
    return res.status(403).json({ error: "No tienes permiso para ver documentos" });
  }

  const { data, error } = await supabase
    .from("gestion_entradas")
    .select("id, categoria, automatico, titulo, descripcion, archivo_path, archivo_nombre, created_at")
    .eq("empresa_id", empresaId)
    .not("archivo_path", "is", null) // el portal solo muestra entradas con documento adjunto
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

portalDocumentosRouter.get("/:entradaId/archivo", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "documentos.descargar"))) {
    return res.status(403).json({ error: "No tienes permiso para descargar documentos" });
  }

  const { data: entrada, error } = await supabase
    .from("gestion_entradas")
    .select("archivo_bucket, archivo_path, empresa_id")
    .eq("id", req.params.entradaId)
    .eq("empresa_id", empresaId) // golden rule: solo su propia empresa
    .maybeSingle();

  if (error || !entrada?.archivo_path || !entrada.archivo_bucket) {
    return res.status(404).json({ error: "Documento no encontrado" });
  }

  const { data, error: errorFirma } = await supabase.storage
    .from(entrada.archivo_bucket)
    .createSignedUrl(entrada.archivo_path, 60 * 60);

  if (errorFirma || !data) return res.status(500).json({ error: errorFirma?.message ?? "No se pudo generar el enlace" });
  res.json({ url: data.signedUrl });
});
