import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const paquetesAdminRouter = Router();

const esquemaPaquete = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  coste_implementacion: z.number().min(0).default(0),
  metodo_facturacion: z.enum(["lead", "suscripcion"]),
  precio_por_lead: z.number().min(0).optional().nullable(),
  leads_incluidos_mes: z.number().int().min(0).optional().nullable(),
  coste_mensual: z.number().min(0).optional().nullable(),
  precio_lead_adicional: z.number().min(0).optional().nullable(),
  servicios_incluidos: z.record(z.string(), z.boolean()).default({}),
  orden: z.number().int().optional().default(0),
});

paquetesAdminRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("paquetes")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

paquetesAdminRouter.post("/", async (req, res) => {
  const parseo = esquemaPaquete.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase.from("paquetes").insert(parseo.data).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

paquetesAdminRouter.put("/:id", async (req, res) => {
  const parseo = esquemaPaquete.partial().safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("paquetes")
    .update(parseo.data)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Baja lógica: no se borra físicamente para no perder el histórico de
// empresas que ya lo tengan asignado.
paquetesAdminRouter.delete("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("paquetes")
    .update({ activo: false })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Paquete asignado a una empresa, con los valores efectivos ya calculados
// (override del cliente si existe, si no el valor general del paquete).
paquetesAdminRouter.get("/asignado/:empresaId", async (req, res) => {
  const { data: asignacion, error } = await supabase
    .from("empresa_paquete")
    .select("*, paquetes(*)")
    .eq("empresa_id", req.params.empresaId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!asignacion || !asignacion.paquetes) return res.json(null);

  const paquete = asignacion.paquetes as Record<string, unknown>;
  const override = (asignacion.override ?? {}) as Record<string, unknown>;
  const CAMPOS_SOBREESCRIBIBLES = [
    "coste_implementacion",
    "precio_por_lead",
    "leads_incluidos_mes",
    "coste_mensual",
    "precio_lead_adicional",
  ];

  const efectivo: Record<string, unknown> = { ...paquete };
  for (const campo of CAMPOS_SOBREESCRIBIBLES) {
    if (override[campo] !== undefined && override[campo] !== null) {
      efectivo[campo] = override[campo];
    }
  }

  res.json({
    paqueteId: asignacion.paquete_id,
    override,
    efectivo,
    paquete,
  });
});

const esquemaAsignar = z.object({
  paqueteId: z.string().uuid().nullable(),
  override: z
    .record(z.string(), z.number().nullable())
    .optional()
    .default({}),
});

paquetesAdminRouter.put("/asignado/:empresaId", async (req, res) => {
  const parseo = esquemaAsignar.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("empresa_paquete")
    .upsert(
      {
        empresa_id: req.params.empresaId,
        paquete_id: parseo.data.paqueteId,
        override: parseo.data.override,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "empresa_id" }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
