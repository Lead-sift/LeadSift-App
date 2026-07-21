const GRAPH_API_VERSION = "v21.0";

function requireEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre} en el entorno`);
  }
  return valor;
}

// Envía un mensaje de texto de WhatsApp usando el número (de prueba o real)
// configurado en META_WHATSAPP_PHONE_NUMBER_ID.
export async function enviarMensajeWhatsApp(destinatario: string, texto: string) {
  const phoneNumberId = requireEnv("META_WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requireEnv("META_WHATSAPP_ACCESS_TOKEN");

  const respuesta = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destinatario,
        type: "text",
        text: { body: texto },
      }),
    }
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(`Error enviando WhatsApp: ${JSON.stringify(datos)}`);
  }

  return datos;
}
