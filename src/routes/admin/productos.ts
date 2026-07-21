import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const productosAdminRouter = Router();

productosAdminRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase.from("productos").select("*").order("nombre");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const esquemaProducto = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  precio_base: z.number().optional(),
});

productosAdminRouter.post("/", async (req, res) => {
  const parseo = esquemaProducto.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase.from("productos").insert(parseo.data).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Asigna un producto contratado a una empresa cliente.
productosAdminRouter.post("/asignar", async (req, res) => {
  const esquema = z.object({ empresaId: z.string().uuid(), productoId: z.string().uuid() });
  const parseo = esquema.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("empresa_productos")
    .insert({ empresa_id: parseo.data.empresaId, producto_id: parseo.data.productoId })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});
