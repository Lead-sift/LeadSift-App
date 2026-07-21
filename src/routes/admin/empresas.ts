import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const empresasAdminRouter = Router();

empresasAdminRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

empresasAdminRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Empresa no encontrada" });
  res.json(data);
});

// "nombre" sigue siendo el nombre de columna en Supabase (para no romper el
// resto del código que ya lo usa: prompts, notificaciones...); en el
// formulario se etiqueta como "Nombre y Apellidos / Razón Social".
const esquemaEmpresa = z.object({
  nombre: z.string().min(1),
  sector: z.string().min(1),
  tono_comunicacion: z.string().default("cercano"),
  idioma_principal: z.string().default("es"),
  emailNotificacion: z.string().email().optional().or(z.literal("")),

  nif_cif_nie: z.string().max(9).optional().or(z.literal("")),

  tipo_via: z.string().max(30).optional().or(z.literal("")),
  nombre_via: z.string().max(150).optional().or(z.literal("")),
  numero_via: z.string().max(10).optional().or(z.literal("")),
  piso: z.string().max(10).optional().or(z.literal("")),
  puerta: z.string().max(10).optional().or(z.literal("")),
  codigo_postal: z.string().max(5).optional().or(z.literal("")),
  municipio: z.string().max(100).optional().or(z.literal("")),
  provincia: z.string().max(100).optional().or(z.literal("")),

  nombre_contacto: z.string().max(150).optional().or(z.literal("")),
  rol_contacto: z.string().max(50).optional().or(z.literal("")),
  email_contacto: z.string().email().max(150).optional().or(z.literal("")),
  telefono_contacto: z.string().max(20).optional().or(z.literal("")),

  telefono_comunicacion: z.string().max(20).optional().or(z.literal("")),
  facturacion_anual: z.number().optional().nullable(),
});

function construirDatosEmpresa(datos: z.infer<typeof esquemaEmpresa>) {
  const { emailNotificacion, ...resto } = datos;
  return {
    ...resto,
    canal_config: emailNotificacion ? { email_notificacion: emailNotificacion } : {},
  };
}

empresasAdminRouter.post("/", async (req, res) => {
  const parseo = esquemaEmpresa.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { data, error } = await supabase
    .from("empresas")
    .insert(construirDatosEmpresa(parseo.data))
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

empresasAdminRouter.put("/:id", async (req, res) => {
  const parseo = esquemaEmpresa.partial().safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });

  const { emailNotificacion, ...datosEmpresa } = parseo.data;
  const actualizacion: Record<string, unknown> = { ...datosEmpresa };
  if (emailNotificacion !== undefined) {
    actualizacion.canal_config = emailNotificacion ? { email_notificacion: emailNotificacion } : {};
  }

  const { data, error } = await supabase
    .from("empresas")
    .update(actualizacion)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Baja lógica, no borrado físico: preserva el histórico de conversaciones/leads.
empresasAdminRouter.delete("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("empresas")
    .update({ activo: false })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
