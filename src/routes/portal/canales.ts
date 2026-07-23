import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";
import { tienePermisoPortal } from "../../services/portalPermisos.js";

export const portalCanalesRouter = Router();

// Siempre req.perfil.empresa_id, nunca un id que venga del cliente.
// Incluye contadores por canal (en curso / gestiono yo / cerrados) para que
// el cliente vea de un vistazo cómo va cada canal antes de entrar a Leads.
portalCanalesRouter.get("/", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  const [{ data: canales, error }, { data: conversaciones }, { data: pausados }] = await Promise.all([
    supabase
      .from("empresa_canales")
      .select("canal, estado_conexion, pausado, pausado_en, ultima_actividad")
      .eq("empresa_id", empresaId),
    supabase.from("conversaciones").select("canal, resultado, remitente_contacto").eq("empresa_id", empresaId),
    supabase.from("contactos_pausados").select("canal, remitente_contacto").eq("empresa_id", empresaId),
  ]);

  if (error) return res.status(500).json({ error: error.message });

  const clavesPausadas = new Set((pausados ?? []).map((p) => `${p.canal}::${p.remitente_contacto}`));
  const contadoresPorCanal = new Map<string, { enCurso: number; gestion: number; cerrados: number }>();
  for (const c of conversaciones ?? []) {
    const contador = contadoresPorCanal.get(c.canal) ?? { enCurso: 0, gestion: 0, cerrados: 0 };
    const gestionado = clavesPausadas.has(`${c.canal}::${c.remitente_contacto}`);
    if (gestionado) contador.gestion += 1;
    else if (c.resultado === "confirmado") contador.cerrados += 1;
    else if (!c.resultado) contador.enCurso += 1;
    contadoresPorCanal.set(c.canal, contador);
  }

  const resultado = (canales ?? []).map((c) => ({
    ...c,
    contadores: contadoresPorCanal.get(c.canal) ?? { enCurso: 0, gestion: 0, cerrados: 0 },
  }));

  res.json(resultado);
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
