import { Router } from "express";
import { z } from "zod";
import { supabase } from "../services/supabaseClient.js";

export const revisionRouter = Router();

// Cola de mensajes generados por la IA pendientes de aprobación humana
// (modo borrador). Incluye el contexto de la conversación y del lead para
// que quien revisa no tenga que ir a buscarlo a otro sitio.
revisionRouter.get("/pendientes", async (_req, res) => {
  const { data: mensajes, error } = await supabase
    .from("mensajes")
    .select(
      "id, conversacion_id, contenido, created_at, conversaciones(id, canal, remitente_contacto, empresa_id, empresas(nombre))"
    )
    .eq("requiere_aprobacion", true)
    .is("aprobado", null)
    .order("created_at", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const conversacionIds = mensajes.map((m) => m.conversacion_id);
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .in("conversacion_id", conversacionIds.length ? conversacionIds : [""]);

  const mensajesConLead = mensajes.map((m) => ({
    ...m,
    lead: leads?.find((l) => l.conversacion_id === m.conversacion_id) ?? null,
  }));

  res.json(mensajesConLead);
});

const esquemaDecision = z.object({
  accion: z.enum(["aprobar", "rechazar"]),
  contenidoEditado: z.string().min(1).optional(),
});

// Aprobar (con edición opcional del texto) o rechazar un mensaje en borrador.
// Aprobar = "listo para enviar al cliente" (el envío real por email/WhatsApp
// se conecta en la Fase 4). Rechazar = no se envía, requiere seguimiento manual.
revisionRouter.post("/:mensajeId/decidir", async (req, res) => {
  const parseo = esquemaDecision.safeParse(req.body);
  if (!parseo.success) {
    return res.status(400).json({ error: parseo.error.flatten() });
  }

  const { mensajeId } = req.params;
  const { accion, contenidoEditado } = parseo.data;

  const actualizacion: Record<string, unknown> = {
    aprobado: accion === "aprobar",
  };
  if (accion === "aprobar" && contenidoEditado) {
    actualizacion.contenido = contenidoEditado;
  }

  const { data, error } = await supabase
    .from("mensajes")
    .update(actualizacion)
    .eq("id", mensajeId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});
