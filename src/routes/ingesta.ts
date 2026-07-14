import { Router } from "express";
import { z } from "zod";
import { procesarMensajeEntrante } from "../services/procesarMensaje.js";
import { empresaEjemplo } from "../prompts/plantillaBase.js";

export const ingestaRouter = Router();

const esquemaMensaje = z.object({
  empresaId: z.string().uuid(),
  canal: z.enum(["email", "formulario", "whatsapp"]),
  remitenteContacto: z.string().min(1),
  texto: z.string().min(1),
});

ingestaRouter.post("/", async (req, res) => {
  const parseo = esquemaMensaje.safeParse(req.body);
  if (!parseo.success) {
    return res.status(400).json({ error: parseo.error.flatten() });
  }

  try {
    // TODO: sustituir empresaEjemplo por la configuración real cargada
    // desde la tabla `empresas` a partir de parseo.data.empresaId.
    const resultado = await procesarMensajeEntrante(parseo.data, empresaEjemplo);
    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error procesando el mensaje" });
  }
});
