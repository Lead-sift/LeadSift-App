import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const gestionAdminRouter = Router();

const subidaArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

gestionAdminRouter.get("/:empresaId", async (req, res) => {
  const { data, error } = await supabase
    .from("gestion_entradas")
    .select("*, perfiles(nombre)")
    .eq("empresa_id", req.params.empresaId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(
    (data ?? []).map((e) => ({
      ...e,
      creadoPorNombre: (e as any).perfiles?.nombre ?? null,
    }))
  );
});

const esquemaEntrada = z.object({
  categoria: z.enum(["factura", "contrato", "contrato_lopd", "otros"]),
  titulo: z.string().min(1).max(200),
  descripcion: z.string().max(2000).optional(),
});

gestionAdminRouter.post("/:empresaId", subidaArchivo.single("archivo"), async (req, res) => {
  const parseo = esquemaEntrada.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  let archivoBucket: "gestion-clientes" | null = null;
  let archivoPath: string | null = null;
  let archivoNombre: string | null = null;

  if (req.file) {
    archivoBucket = "gestion-clientes";
    archivoNombre = req.file.originalname;
    archivoPath = `${req.params.empresaId}/${Date.now()}-${req.file.originalname}`;

    const { error: errorSubida } = await supabase.storage
      .from(archivoBucket)
      .upload(archivoPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (errorSubida) return res.status(500).json({ error: errorSubida.message });
  }

  const { data, error } = await supabase
    .from("gestion_entradas")
    .insert({
      empresa_id: req.params.empresaId,
      categoria: parseo.data.categoria,
      titulo: parseo.data.titulo,
      descripcion: parseo.data.descripcion ?? null,
      automatico: false,
      creado_por: req.perfil?.id ?? null,
      archivo_bucket: archivoBucket,
      archivo_path: archivoPath,
      archivo_nombre: archivoNombre,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Enlace temporal (1h) para descargar el documento adjunto de una entrada,
// sea del repositorio de gestión o del de facturas ya emitidas.
gestionAdminRouter.get("/archivo/:entradaId", async (req, res) => {
  const { data: entrada, error } = await supabase
    .from("gestion_entradas")
    .select("archivo_bucket, archivo_path")
    .eq("id", req.params.entradaId)
    .single();

  if (error || !entrada?.archivo_path || !entrada.archivo_bucket) {
    return res.status(404).json({ error: "Esta entrada no tiene ningún documento adjunto" });
  }

  const { data, error: errorFirma } = await supabase.storage
    .from(entrada.archivo_bucket)
    .createSignedUrl(entrada.archivo_path, 60 * 60);

  if (errorFirma || !data) return res.status(500).json({ error: errorFirma?.message ?? "No se pudo generar el enlace" });
  res.json({ url: data.signedUrl });
});
