import { Router } from "express";
import { z } from "zod";
import { preguntarAsistente } from "../../services/asistenteInterno.js";

export const asistenteAdminRouter = Router();

const esquema = z.object({ pregunta: z.string().min(1).max(500) });

asistenteAdminRouter.post("/", async (req, res) => {
  const parseo = esquema.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  try {
    const respuesta = await preguntarAsistente(parseo.data.pregunta);
    res.json({ respuesta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error procesando la pregunta" });
  }
});
