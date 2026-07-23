import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";
import { tienePermisoPortal } from "../../services/portalPermisos.js";

export const portalCanalesRouter = Router();

// Siempre req.perfil.empresa_id, nunca un id que venga del cliente.
portalCanalesRouter.get("/", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  const { data, error } = await supabase
    .from("empresa_canales")
    .select("canal, estado_conexion, pausado, pausado_en, ultima_actividad")
    .eq("empresa_id", empresaId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const CANALES = [
  "formulario",
  "whatsapp_independiente",
  "whatsapp_coexistence",
  "email_funcional",
  "instagram_chat",
  "chat_web",
] as const;

const esquemaPausa = z.object({
  canal: z.enum(CANALES),
  pausado: z.boolean(),
});

portalCanalesRouter.put("/pausa", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "canales.pausar"))) {
    return res.status(403).json({ error: "No tienes permiso para pausar canales" });
  }

  const parseo = esquemaPausa.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("empresa_canales")
    .upsert(
      {
        empresa_id: empresaId,
        canal: parseo.data.canal,
        pausado: parseo.data.pausado,
        pausado_en: parseo.data.pausado ? new Date().toISOString() : null,
        pausado_por: parseo.data.pausado ? req.perfil!.id : null,
      },
      { onConflict: "empresa_id,canal" }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
