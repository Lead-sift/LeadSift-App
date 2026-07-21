import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const documentosAdminRouter = Router();

documentosAdminRouter.get("/:empresaId", async (req, res) => {
  const { data, error } = await supabase
    .from("documentos_empresa")
    .select("*")
    .eq("empresa_id", req.params.empresaId)
    .order("tipo", { ascending: true })
    .order("version", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const esquemaDocumento = z.object({
  tipo: z.string().min(1).max(50),
  contenido: z.string().min(1),
});

// Cada guardado crea una nueva versión de ese tipo de documento (no
// sobreescribe), pero al cargar el prompt en tiempo real siempre se usa la
// última versión — así que el efecto es inmediato en la siguiente consulta.
documentosAdminRouter.post("/:empresaId", async (req, res) => {
  const parseo = esquemaDocumento.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data: ultimo } = await supabase
    .from("documentos_empresa")
    .select("version")
    .eq("empresa_id", req.params.empresaId)
    .eq("tipo", parseo.data.tipo)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("documentos_empresa")
    .insert({
      empresa_id: req.params.empresaId,
      tipo: parseo.data.tipo,
      contenido: parseo.data.contenido,
      version: (ultimo?.version ?? 0) + 1,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

documentosAdminRouter.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("documentos_empresa").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
