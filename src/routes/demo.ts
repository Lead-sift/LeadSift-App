import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { clasificarIntencion } from "../services/clasificador.js";
import { cualificarLead } from "../services/cualificador.js";
import { generarRespuestaInformativa } from "../services/responderInformativa.js";
import { construirPromptSistema, leadSift } from "../prompts/plantillaBase.js";

export const demoRouter = Router();

// Formulario público de marketing: sin autenticación, así que hay que
// limitar el abuso desde el día 1 (cada llamada consume tokens de la API).
const limitadorDemo = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas pruebas seguidas. Inténtalo de nuevo en unos minutos." },
});

const esquemaDemo = z.object({
  texto: z.string().min(1).max(1000),
});

const promptDemo = construirPromptSistema(leadSift);

// Endpoint sin estado: no escribe en Supabase ni dispara notificaciones.
// El visitante pregunta por los propios servicios/precios de LeadSift,
// y el sistema responde en vivo con esa información real —
// es a la vez la demo del producto y un canal de captación de leads.
demoRouter.post("/", limitadorDemo, async (req, res) => {
  const parseo = esquemaDemo.safeParse(req.body);
  if (!parseo.success) {
    return res.status(400).json({ error: parseo.error.flatten() });
  }

  try {
    const { texto } = parseo.data;
    const { intencion } = await clasificarIntencion(texto);

    if (intencion === "spam") {
      return res.json({ intencion, mensaje: "Descartado como spam antes de gastar en el modelo de cualificación." });
    }

    if (intencion === "informativa") {
      const { respuesta } = await generarRespuestaInformativa(promptDemo, texto);
      return res.json({ intencion, respuesta });
    }

    const { ficha } = await cualificarLead(promptDemo, texto);
    res.json({ intencion, ficha });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error procesando la demo" });
  }
});
