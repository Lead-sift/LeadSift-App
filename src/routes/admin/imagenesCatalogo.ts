import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const imagenesCatalogoAdminRouter = Router();

imagenesCatalogoAdminRouter.get("/:empresaId", async (req, res) => {
  const { data, error } = await supabase
    .from("imagenes_catalogo")
    .select("*")
    .eq("empresa_id", req.params.empresaId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const esquemaEtiqueta = z.object({ etiqueta: z.string().max(300) });

imagenesCatalogoAdminRouter.put("/:id", async (req, res) => {
  const parseo = esquemaEtiqueta.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("imagenes_catalogo")
    .update({ etiqueta: parseo.data.etiqueta })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

imagenesCatalogoAdminRouter.delete("/:id", async (req, res) => {
  const { data: imagen } = await supabase
    .from("imagenes_catalogo")
    .select("ruta_storage")
    .eq("id", req.params.id)
    .single();

  if (imagen) {
    await supabase.storage.from("catalogo-imagenes").remove([imagen.ruta_storage]);
  }

  const { error } = await supabase.from("imagenes_catalogo").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
