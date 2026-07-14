import { supabase } from "./supabaseClient.js";
import { clasificarIntencion } from "./clasificador.js";
import { cualificarLead } from "./cualificador.js";
import { construirPromptSistema, type ConfigEmpresa } from "../prompts/plantillaBase.js";

export interface MensajeEntrante {
  empresaId: string;
  canal: "email" | "formulario" | "whatsapp";
  remitenteContacto: string;
  texto: string;
}

export async function procesarMensajeEntrante(
  mensaje: MensajeEntrante,
  configEmpresa: ConfigEmpresa
) {
  const { data: conversacion, error: errorConversacion } = await supabase
    .from("conversaciones")
    .insert({
      empresa_id: mensaje.empresaId,
      canal: mensaje.canal,
      remitente_contacto: mensaje.remitenteContacto,
    })
    .select()
    .single();

  if (errorConversacion || !conversacion) {
    throw new Error(`No se pudo crear la conversación: ${errorConversacion?.message}`);
  }

  await supabase.from("mensajes").insert({
    conversacion_id: conversacion.id,
    origen: "cliente",
    contenido: mensaje.texto,
  });

  const intencion = await clasificarIntencion(mensaje.texto);

  const requiereCualificacion =
    intencion === "lead_potencial" || intencion === "consulta_disponibilidad";

  if (!requiereCualificacion) {
    return { conversacionId: conversacion.id, intencion, lead: null };
  }

  const promptSistema = construirPromptSistema(configEmpresa);
  const ficha = await cualificarLead(promptSistema, mensaje.texto);

  const { data: lead, error: errorLead } = await supabase
    .from("leads")
    .insert({
      conversacion_id: conversacion.id,
      empresa_id: mensaje.empresaId,
      nombre_contacto: ficha.nombreContacto,
      contacto: ficha.contacto,
      necesidad: ficha.necesidad,
      presupuesto_estimado: ficha.presupuestoEstimado,
      urgencia: ficha.urgencia,
      score: ficha.score,
    })
    .select()
    .single();

  if (errorLead) {
    throw new Error(`No se pudo guardar el lead: ${errorLead.message}`);
  }

  await supabase.from("mensajes").insert({
    conversacion_id: conversacion.id,
    origen: "ia",
    contenido: ficha.respuestaSugerida,
    requiere_aprobacion: true, // modo borrador: revisión humana obligatoria en el piloto
  });

  return { conversacionId: conversacion.id, intencion, lead, ficha };
}
