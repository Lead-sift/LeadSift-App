import { Router } from "express";
import { calcularKpisEmpresas } from "../../services/kpisService.js";

export const kpisAdminRouter = Router();

kpisAdminRouter.get("/", async (_req, res) => {
  try {
    const resultado = await calcularKpisEmpresas();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
