import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const promptsAdminRouter = Router();

// Historial completo de versiones (sandbox y producción) de una empresa.
promptsAdminRouter.get("/:empresaId", async (req, res) => {
  const { data, error } = await supabase
    .from("prompts_sistema")
    .select("*")
    .eq("empresa_id", req.params.empresaId)
    .order("version", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const esquemaNuevaVersion = z.object({
  contenido: z.string().min(1),
  entorno: z.enum(["sandbox", "produccion"]).default("sandbox"),
});

// Crea una nueva versión. Por defecto en modo sandbox: no afecta a lo que
// usan los clientes reales hasta que se publique explícitamente.
promptsAdminRouter.post("/:empresaId", async (req, res) => {
  const parseo = esquemaNuevaVersion.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data: ultima } = await supabase
    .from("prompts_sistema")
    .select("version")
    .eq("empresa_id", req.params.empresaId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const siguienteVersion = (ultima?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from("prompts_sistema")
    .insert({
      empresa_id: req.params.empresaId,
      version: siguienteVersion,
      contenido: parseo.data.contenido,
      entorno: parseo.data.entorno,
      activo: false, // se activa explícitamente al publicar
      creado_por: req.perfil?.id ?? null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Guarda una nueva versión y la deja activa de inmediato (sin pasar por
// sandbox). Pensado para la pestaña "Servicios", donde el prompt de cada
// cliente se trata como configuración en vivo, no como algo a probar antes.
promptsAdminRouter.post("/:empresaId/directo", async (req, res) => {
  const parseo = z.object({ contenido: z.string().min(1) }).safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data: ultima } = await supabase
    .from("prompts_sistema")
    .select("version")
    .eq("empresa_id", req.params.empresaId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const siguienteVersion = (ultima?.version ?? 0) + 1;

  await supabase.from("prompts_sistema").update({ activo: false }).eq("empresa_id", req.params.empresaId);

  const { data, error } = await supabase
    .from("prompts_sistema")
    .insert({
      empresa_id: req.params.empresaId,
      version: siguienteVersion,
      contenido: parseo.data.contenido,
      entorno: "produccion",
      activo: true,
      activado_en: new Date().toISOString(),
      creado_por: req.perfil?.id ?? null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Publica una versión: la marca activa en producción y desactiva las demás
// de esa misma empresa. Es el único punto que afecta a clientes reales.
promptsAdminRouter.post("/:empresaId/:promptId/publicar", async (req, res) => {
  const { empresaId, promptId } = req.params;

  const { error: errorDesactivar } = await supabase
    .from("prompts_sistema")
    .update({ activo: false })
    .eq("empresa_id", empresaId);

  if (errorDesactivar) return res.status(500).json({ error: errorDesactivar.message });

  const { data, error } = await supabase
    .from("prompts_sistema")
    .update({ activo: true, entorno: "produccion", activado_en: new Date().toISOString() })
    .eq("id", promptId)
    .eq("empresa_id", empresaId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
