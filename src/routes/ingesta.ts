import { Router } from "express";
import { z } from "zod";
import { procesarMensajeEntrante } from "../services/procesarMensaje.js";
import { cargarPromptSistemaActivo } from "../services/cargarConfigEmpresa.js";

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
    const promptSistema = await cargarPromptSistemaActivo(parseo.data.empresaId);
    const resultado = await procesarMensajeEntrante(parseo.data, promptSistema);
    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error procesando el mensaje" });
  }
});
