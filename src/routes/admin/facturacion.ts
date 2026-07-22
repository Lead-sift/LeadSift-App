import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";

export const facturacionAdminRouter = Router();

const CAMPOS_SOBREESCRIBIBLES = [
  "coste_implementacion",
  "precio_por_lead",
  "leads_incluidos_mes",
  "coste_mensual",
  "precio_lead_adicional",
] as const;

function calcularEfectivo(paquete: Record<string, any>, override: Record<string, any>) {
  const efectivo = { ...paquete };
  for (const campo of CAMPOS_SOBREESCRIBIBLES) {
    if (override[campo] !== undefined && override[campo] !== null) {
      efectivo[campo] = override[campo];
    }
  }
  return efectivo;
}

function calcularRecibo(efectivo: Record<string, any>, leadsContados: number, incluyeImplementacion: boolean) {
  const costeImplementacion = incluyeImplementacion ? Number(efectivo.coste_implementacion ?? 0) : 0;

  if (efectivo.metodo_facturacion === "lead") {
    const total = leadsContados * Number(efectivo.precio_por_lead ?? 0) + costeImplementacion;
    return { leadsExceso: 0, total };
  }

  const incluidos = Number(efectivo.leads_incluidos_mes ?? 0);
  const leadsExceso = Math.max(0, leadsContados - incluidos);
  const total =
    Number(efectivo.coste_mensual ?? 0) + leadsExceso * Number(efectivo.precio_lead_adicional ?? 0) + costeImplementacion;
  return { leadsExceso, total };
}

facturacionAdminRouter.get("/", async (req, res) => {
  const anio = Number(req.query.anio);
  const mes = Number(req.query.mes);
  if (!anio || !mes) return res.status(400).json({ error: "Faltan anio y mes" });

  const { data, error } = await supabase
    .from("recibos")
    .select("*, empresas(nombre, codigo_cliente)")
    .eq("anio", anio)
    .eq("mes", mes)
    .order("total", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const esquemaGenerar = z.object({
  anio: z.number().int(),
  mes: z.number().int().min(1).max(12),
});

// Genera (o regenera) los recibos del mes para todas las empresas que
// tengan un paquete asignado. El coste de implementación solo se incluye en
// el primer recibo histórico de cada empresa.
facturacionAdminRouter.post("/generar", async (req, res) => {
  const parseo = esquemaGenerar.safeParse(req.body);
  if (!parseo.success) return res.status(400).json({ error: parseo.error.flatten() });
  const { anio, mes } = parseo.data;

  const { data: asignaciones, error: errorAsignaciones } = await supabase
    .from("empresa_paquete")
    .select("empresa_id, paquete_id, override, paquetes(*)")
    .not("paquete_id", "is", null);

  if (errorAsignaciones) return res.status(500).json({ error: errorAsignaciones.message });

  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1)).toISOString();
  const finMes = new Date(Date.UTC(anio, mes, 1)).toISOString();

  const generados = [];
  for (const asignacion of asignaciones ?? []) {
    const paquete = (asignacion as any).paquetes;
    if (!paquete) continue;

    const { count: leadsContados, error: errorLeads } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", asignacion.empresa_id)
      .gte("created_at", inicioMes)
      .lt("created_at", finMes);

    if (errorLeads) return res.status(500).json({ error: errorLeads.message });

    const { count: recibosPrevios, error: errorPrevios } = await supabase
      .from("recibos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", asignacion.empresa_id);

    if (errorPrevios) return res.status(500).json({ error: errorPrevios.message });

    // Comprueba si ya existe recibo de este mes para esta empresa: si es así,
    // no cuenta como "primer recibo" al decidir si incluir la implementación.
    const { data: reciboExistente } = await supabase
      .from("recibos")
      .select("id, incluye_implementacion")
      .eq("empresa_id", asignacion.empresa_id)
      .eq("anio", anio)
      .eq("mes", mes)
      .maybeSingle();

    const incluyeImplementacion = reciboExistente
      ? reciboExistente.incluye_implementacion
      : (recibosPrevios ?? 0) === 0;

    const efectivo = calcularEfectivo(paquete, (asignacion.override ?? {}) as Record<string, any>);
    const { leadsExceso, total } = calcularRecibo(efectivo, leadsContados ?? 0, incluyeImplementacion);

    const { data: recibo, error: errorUpsert } = await supabase
      .from("recibos")
      .upsert(
        {
          empresa_id: asignacion.empresa_id,
          anio,
          mes,
          paquete_id: paquete.id,
          paquete_nombre: paquete.nombre,
          metodo_facturacion: efectivo.metodo_facturacion,
          coste_implementacion: efectivo.coste_implementacion,
          incluye_implementacion: incluyeImplementacion,
          precio_por_lead: efectivo.precio_por_lead,
          coste_mensual: efectivo.coste_mensual,
          leads_incluidos_mes: efectivo.leads_incluidos_mes,
          precio_lead_adicional: efectivo.precio_lead_adicional,
          leads_contados: leadsContados ?? 0,
          leads_exceso: leadsExceso,
          total,
          generado_en: new Date().toISOString(),
        },
        { onConflict: "empresa_id,anio,mes" }
      )
      .select()
      .single();

    if (errorUpsert) return res.status(500).json({ error: errorUpsert.message });
    generados.push(recibo);
  }

  res.json(generados);
});
