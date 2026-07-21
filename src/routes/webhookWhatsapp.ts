import { Router } from "express";

export const webhookWhatsappRouter = Router();

// Handshake de verificación que exige Meta al suscribir un webhook:
// responde con hub.challenge en texto plano si el verify_token coincide.
webhookWhatsappRouter.get("/", (req, res) => {
  const modo = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (modo === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta reintenta el envío si no respondemos rápido con 200, así que se
// responde inmediatamente y se procesa el payload sin bloquear la respuesta.
// TODO: cuando exista el dashboard multi-tenant (hito pendiente), mapear el
// phone_number_id del payload a la empresa cliente correspondiente y pasar
// el mensaje por procesarMensajeEntrante(), igual que ya hace /api/ingesta.
webhookWhatsappRouter.post("/", (req, res) => {
  res.sendStatus(200);

  const valor = req.body?.entry?.[0]?.changes?.[0]?.value;
  const mensajes = valor?.messages;

  if (!mensajes) {
    return; // notificaciones de estado (entregado/leído), no mensajes nuevos
  }

  for (const mensaje of mensajes) {
    console.log("Mensaje de WhatsApp recibido:", {
      de: mensaje.from,
      tipo: mensaje.type,
      texto: mensaje.text?.body,
    });
  }
});
