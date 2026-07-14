import { supabase } from "./supabaseClient.js";
import { clasificarIntencion } from "./clasificador.js";
import { cualificarLead } from "./cualificador.js";
import { generarRespuestaInformativa } from "./responderInformativa.js";
import { notificarComercial, requiereNotificacion } from "./notificarComercial.js";

export interface MensajeEntrante {
  empresaId: string;
  canal: "email" | "formulario" | "whatsapp";
  remitenteContacto: string;
  texto: string;
}

export async function procesarMensajeEntrante(
  mensaje: MensajeEntrante,
  promptSistema: string
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

  if (intencion === "spam") {
    return { conversacionId: conversacion.id, intencion, lead: null };
  }

  if (intencion === "informativa") {
    const respuesta = await generarRespuestaInformativa(promptSistema, mensaje.texto);
    await supabase.from("mensajes").insert({
      conversacion_id: conversacion.id,
      origen: "ia",
      contenido: respuesta,
      requiere_aprobacion: false, // bajo riesgo: se envía automáticamente
      aprobado: true,
    });
    return { conversacionId: conversacion.id, intencion, lead: null, respuesta };
  }

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

  if (requiereNotificacion(lead, ficha.requiereEscaladoHumano)) {
    try {
      await notificarComercial(
        mensaje.empresaId,
        lead,
        { canal: mensaje.canal, remitenteContacto: mensaje.remitenteContacto },
        ficha.motivoEscalado
      );
    } catch (error) {
      // No bloquea la respuesta al cliente: el lead ya está guardado y
      // visible en el panel de revisión aunque falle el email.
      console.error("Error notificando al comercial:", error);
    }
  }

  return { conversacionId: conversacion.id, intencion, lead, ficha };
}
