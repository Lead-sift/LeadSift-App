import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";
import { calcularEstado } from "../../services/leadsService.js";
import { tienePermisoPortal } from "../../services/portalPermisos.js";

export const portalLeadsRouter = Router();

async function calcularUltimaActividad(conversacionIds: string[]): Promise<Map<string, string>> {
  if (conversacionIds.length === 0) return new Map();

  const { data } = await supabase
    .from("mensajes")
    .select("conversacion_id, created_at")
    .in("conversacion_id", conversacionIds);

  const mapa = new Map<string, string>();
  for (const m of data ?? []) {
    const actual = mapa.get(m.conversacion_id);
    if (!actual || m.created_at > actual) mapa.set(m.conversacion_id, m.created_at);
  }
  return mapa;
}

// Verifica que la conversación pertenezca a la empresa del usuario (golden
// rule) antes de devolver nada. Ante la duda, 404 — nunca se revela ni
// siquiera que la conversación existe si no es suya.
async function cargarConversacionPropia(conversacionId: string, empresaId: string) {
  const { data: conversacion } = await supabase
    .from("conversaciones")
    .select("*")
    .eq("id", conversacionId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return conversacion;
}

portalLeadsRouter.get("/", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "leads.ver"))) {
    return res.status(403).json({ error: "No tienes permiso para ver leads" });
  }

  let consulta = supabase
    .from("conversaciones")
    .select("id, canal, intencion, resultado, remitente_contacto, created_at")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (typeof req.query.canal === "string" && req.query.canal) {
    consulta = consulta.eq("canal", req.query.canal);
  }

  const { data: conversaciones, error } = await consulta;
  if (error) return res.status(500).json({ error: error.message });

  const ids = (conversaciones ?? []).map((c) => c.id);
  const [{ data: leadsData }, { data: pausados }] = await Promise.all([
    supabase
      .from("leads")
      .select("conversacion_id, score, nombre_contacto, necesidad, contacto")
      .in("conversacion_id", ids.length ? ids : [""]),
    supabase.from("contactos_pausados").select("canal, remitente_contacto").eq("empresa_id", empresaId),
  ]);

  const mapaLeads = new Map((leadsData ?? []).map((l) => [l.conversacion_id, l]));
  const mapaActividad = await calcularUltimaActividad(ids);
  const clavesPausadas = new Set((pausados ?? []).map((p) => `${p.canal}::${p.remitente_contacto}`));

  const resultado = (conversaciones ?? []).map((c) => {
    const ultimaActividad = mapaActividad.get(c.id) ?? c.created_at;
    const lead = mapaLeads.get(c.id);
    return {
      id: c.id,
      estado: calcularEstado(c.resultado, ultimaActividad),
      temperatura: lead?.score ?? "frio",
      resultado: c.resultado,
      canal: c.canal,
      remitenteContacto: c.remitente_contacto,
      createdAt: c.created_at,
      ultimaActividad,
      necesidad: lead?.necesidad ?? null,
      pausado: clavesPausadas.has(`${c.canal}::${c.remitente_contacto}`),
    };
  });

  res.json(resultado);
});

portalLeadsRouter.get("/:conversacionId", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "leads.ver_conversacion"))) {
    return res.status(403).json({ error: "No tienes permiso para ver esta conversación" });
  }

  const conversacion = await cargarConversacionPropia(req.params.conversacionId, empresaId);
  if (!conversacion) return res.status(404).json({ error: "Lead no encontrado" });

  const [{ data: lead }, { data: mensajes }, { data: pausado }] = await Promise.all([
    supabase.from("leads").select("*").eq("conversacion_id", req.params.conversacionId).maybeSingle(),
    supabase
      .from("mensajes")
      .select("id, origen, contenido, created_at")
      .eq("conversacion_id", req.params.conversacionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("contactos_pausados")
      .select("empresa_id")
      .eq("empresa_id", empresaId)
      .eq("canal", conversacion.canal)
      .eq("remitente_contacto", conversacion.remitente_contacto)
      .maybeSingle(),
  ]);

  const mapaActividad = await calcularUltimaActividad([req.params.conversacionId]);
  const ultimaActividad = mapaActividad.get(req.params.conversacionId) ?? conversacion.created_at;

  res.json({
    ...conversacion,
    estado: calcularEstado(conversacion.resultado, ultimaActividad),
    temperatura: lead?.score ?? "frio",
    ultimaActividad,
    lead,
    mensajes: mensajes ?? [],
    pausado: Boolean(pausado),
  });
});

const esquemaActualizacion = z.object({
  resultado: z.enum(["confirmado", "desestimado", "spam"]).nullable().optional(),
  motivoDesestimado: z.string().max(200).nullable().optional(),
});

portalLeadsRouter.put("/:conversacionId", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "leads.marcar_resultado"))) {
    return res.status(403).json({ error: "No tienes permiso para marcar el resultado de un lead" });
  }

  const conversacion = await cargarConversacionPropia(req.params.conversacionId, empresaId);
  if (!conversacion) return res.status(404).json({ error: "Lead no encontrado" });

  const parseo = esquemaActualizacion.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const actualizacion: Record<string, unknown> = {};
  if (parseo.data.resultado !== undefined) {
    actualizacion.resultado = parseo.data.resultado;
    if (parseo.data.resultado !== "desestimado") actualizacion.motivo_desestimado = null;
  }
  if (parseo.data.motivoDesestimado !== undefined) {
    actualizacion.motivo_desestimado = parseo.data.motivoDesestimado;
  }

  const { data, error } = await supabase
    .from("conversaciones")
    .update(actualizacion)
    .eq("id", req.params.conversacionId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const esquemaPausa = z.object({ pausado: z.boolean() });

// "Tomar el control" de un chat: pausa el bot para ese contacto concreto en
// ese canal (no todo el canal), sin tocar la conversación de otros
// contactos. Ver 019_portal_pausa_contacto.sql.
portalLeadsRouter.post("/:conversacionId/pausar", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "leads.pausar_bot"))) {
    return res.status(403).json({ error: "No tienes permiso para pausar el bot de esta conversación" });
  }

  const conversacion = await cargarConversacionPropia(req.params.conversacionId, empresaId);
  if (!conversacion) return res.status(404).json({ error: "Lead no encontrado" });

  const parseo = esquemaPausa.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  if (parseo.data.pausado) {
    const { error } = await supabase.from("contactos_pausados").upsert(
      {
        empresa_id: empresaId,
        canal: conversacion.canal,
        remitente_contacto: conversacion.remitente_contacto,
        pausado_en: new Date().toISOString(),
        pausado_por: req.perfil!.id,
      },
      { onConflict: "empresa_id,canal,remitente_contacto" }
    );
    if (error) return res.status(500).json({ error: error.message });
  } else {
    const { error } = await supabase
      .from("contactos_pausados")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("canal", conversacion.canal)
      .eq("remitente_contacto", conversacion.remitente_contacto);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, pausado: parseo.data.pausado });
});

const esquemaRespuesta = z.object({ mensaje: z.string().min(1).max(4000) });

// Registra una respuesta manual del comercial en el hilo. El envío real por
// el canal correspondiente (WhatsApp/Instagram/email/chat web) depende de
// la integración de salida de cada canal, varias todavía pendientes — de
// momento queda registrada como la respuesta oficial dada al cliente.
portalLeadsRouter.post("/:conversacionId/responder", async (req, res) => {
  const empresaId = req.perfil!.empresa_id;
  if (!empresaId) return res.status(403).json({ error: "Usuario sin empresa asignada" });

  if (!(await tienePermisoPortal(req.perfil!.id, "leads.responder_manual"))) {
    return res.status(403).json({ error: "No tienes permiso para responder manualmente" });
  }

  const conversacion = await cargarConversacionPropia(req.params.conversacionId, empresaId);
  if (!conversacion) return res.status(404).json({ error: "Lead no encontrado" });

  const parseo = esquemaRespuesta.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: req.params.conversacionId,
      empresa_id: empresaId,
      origen: "humano",
      contenido: parseo.data.mensaje,
      requiere_aprobacion: false,
      aprobado: true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});
