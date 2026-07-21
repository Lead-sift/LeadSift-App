import { supabase } from "./supabaseClient.js";
import { clasificarIntencion, type UsoTokens } from "./clasificador.js";
import { cualificarLead } from "./cualificador.js";
import { generarRespuestaInformativa } from "./responderInformativa.js";
import { notificarComercial, requiereNotificacion } from "./notificarComercial.js";

export interface MensajeEntrante {
  empresaId: string;
  canal: "email" | "formulario" | "whatsapp";
  remitenteContacto: string;
  texto: string;
}

// Precio aproximado por token (USD), solo para tener una referencia de coste
// en los KPIs — no es la factura real de Anthropic, que puede variar.
const PRECIO_POR_TOKEN: Record<string, { entrada: number; salida: number }> = {
  "claude-haiku-4-5-20251001": { entrada: 1 / 1_000_000, salida: 5 / 1_000_000 },
  "claude-sonnet-5": { entrada: 3 / 1_000_000, salida: 15 / 1_000_000 },
};

async function registrarConsumo(empresaId: string, mensajeId: string | null, uso: UsoTokens) {
  const precio = PRECIO_POR_TOKEN[uso.modelo];
  const costoEstimado = precio
    ? uso.tokensEntrada * precio.entrada + uso.tokensSalida * precio.salida
    : null;

  const { error } = await supabase.from("consumo_tokens").insert({
    empresa_id: empresaId,
    mensaje_id: mensajeId,
    modelo: uso.modelo,
    tokens_entrada: uso.tokensEntrada,
    tokens_salida: uso.tokensSalida,
    costo_estimado: costoEstimado,
  });

  if (error) {
    // No debe romper el flujo de respuesta al cliente por un fallo de KPIs.
    console.error("Error registrando consumo de tokens:", error);
  }
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

  await supabase.from("empresa_canales").upsert(
    {
      empresa_id: mensaje.empresaId,
      canal: mensaje.canal,
      estado_conexion: "conectado",
      ultima_actividad: new Date().toISOString(),
    },
    { onConflict: "empresa_id,canal" }
  );

  const { data: mensajeCliente } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: conversacion.id,
      empresa_id: mensaje.empresaId,
      origen: "cliente",
      contenido: mensaje.texto,
    })
    .select()
    .single();

  const { intencion, uso: usoClasificacion } = await clasificarIntencion(mensaje.texto);
  await registrarConsumo(mensaje.empresaId, mensajeCliente?.id ?? null, usoClasificacion);
  await supabase.from("conversaciones").update({ intencion }).eq("id", conversacion.id);

  if (intencion === "spam") {
    return { conversacionId: conversacion.id, intencion, lead: null };
  }

  if (intencion === "informativa") {
    const { respuesta, uso } = await generarRespuestaInformativa(promptSistema, mensaje.texto);
    const { data: mensajeIa } = await supabase
      .from("mensajes")
      .insert({
        conversacion_id: conversacion.id,
        empresa_id: mensaje.empresaId,
        origen: "ia",
        contenido: respuesta,
        requiere_aprobacion: false, // bajo riesgo: se envía automáticamente
        aprobado: true,
      })
      .select()
      .single();
    await registrarConsumo(mensaje.empresaId, mensajeIa?.id ?? null, uso);
    return { conversacionId: conversacion.id, intencion, lead: null, respuesta };
  }

  const { ficha, uso: usoCualificacion } = await cualificarLead(promptSistema, mensaje.texto);

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

  const { data: mensajeIa } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: conversacion.id,
      empresa_id: mensaje.empresaId,
      origen: "ia",
      contenido: ficha.respuestaSugerida,
      requiere_aprobacion: true, // modo borrador: revisión humana obligatoria en el piloto
    })
    .select()
    .single();
  await registrarConsumo(mensaje.empresaId, mensajeIa?.id ?? null, usoCualificacion);

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
