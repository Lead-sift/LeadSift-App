import { Router } from "express";
import { z } from "zod";
import { supabase } from "../../services/supabaseClient.js";
import { generarFacturaPdf } from "../../services/generarFacturaPdf.js";
import { obtenerTransporteEmail } from "../../services/emailClient.js";
import { registrarEntradaGestion } from "../../services/gestionClientes.js";

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

async function cargarReciboConEmpresa(reciboId: string) {
  const { data: recibo, error } = await supabase.from("recibos").select("*").eq("id", reciboId).single();
  if (error || !recibo) return { recibo: null, empresa: null };

  const { data: empresa } = await supabase
    .from("empresas")
    .select(
      "nombre, nif_cif_nie, codigo_cliente, tipo_via, nombre_via, numero_via, municipio, provincia, codigo_postal, cuenta_facturacion, email_facturacion, email_contacto, canal_config"
    )
    .eq("id", recibo.empresa_id)
    .single();

  return { recibo, empresa };
}

// Genera el PDF (asignando número de factura si aún no lo tiene) y lo sube
// al repositorio del cliente en Storage.
facturacionAdminRouter.post("/:reciboId/emitir", async (req, res) => {
  const { recibo, empresa } = await cargarReciboConEmpresa(req.params.reciboId);
  if (!recibo || !empresa) return res.status(404).json({ error: "Recibo no encontrado" });

  let numeroFactura = recibo.numero_factura as string | null;
  if (!numeroFactura) {
    const { data: numeroGenerado, error: errorNumero } = await supabase.rpc("siguiente_numero_factura");
    if (errorNumero || !numeroGenerado) {
      return res.status(500).json({ error: errorNumero?.message ?? "No se pudo generar el número de factura" });
    }
    numeroFactura = numeroGenerado as string;
  }

  const pdfBuffer = await generarFacturaPdf(empresa as any, { ...recibo, numero_factura: numeroFactura } as any);
  const pdfPath = `${recibo.empresa_id}/${numeroFactura}.pdf`;

  const { error: errorSubida } = await supabase.storage
    .from("facturas-clientes")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (errorSubida) return res.status(500).json({ error: errorSubida.message });

  const { data: actualizado, error: errorUpdate } = await supabase
    .from("recibos")
    .update({ numero_factura: numeroFactura, pdf_path: pdfPath, emitido_en: new Date().toISOString() })
    .eq("id", req.params.reciboId)
    .select()
    .single();

  if (errorUpdate) return res.status(500).json({ error: errorUpdate.message });

  await registrarEntradaGestion({
    empresaId: recibo.empresa_id,
    categoria: "factura",
    automatico: true,
    titulo: `Factura ${numeroFactura} emitida`,
    descripcion: `Periodo ${recibo.mes}/${recibo.anio} — Total: ${recibo.total} €`,
    creadoPor: req.perfil?.id ?? null,
    archivoBucket: "facturas-clientes",
    archivoPath: pdfPath,
    archivoNombre: `${numeroFactura}.pdf`,
  });

  res.json(actualizado);
});

// Enlace temporal (1 hora) para descargar/ver el PDF de una factura ya emitida.
facturacionAdminRouter.get("/:reciboId/pdf", async (req, res) => {
  const { data: recibo, error } = await supabase
    .from("recibos")
    .select("pdf_path")
    .eq("id", req.params.reciboId)
    .single();

  if (error || !recibo?.pdf_path) return res.status(404).json({ error: "Esta factura todavía no se ha emitido" });

  const { data, error: errorFirma } = await supabase.storage
    .from("facturas-clientes")
    .createSignedUrl(recibo.pdf_path, 60 * 60);

  if (errorFirma || !data) return res.status(500).json({ error: errorFirma?.message ?? "No se pudo generar el enlace" });
  res.json({ url: data.signedUrl });
});

// Envía la factura ya emitida por email al contacto de facturación del cliente.
facturacionAdminRouter.post("/:reciboId/enviar", async (req, res) => {
  const { recibo, empresa } = await cargarReciboConEmpresa(req.params.reciboId);
  if (!recibo || !empresa) return res.status(404).json({ error: "Recibo no encontrado" });
  if (!recibo.pdf_path || !recibo.numero_factura) {
    return res.status(400).json({ error: "Primero hay que emitir la factura" });
  }

  const destinatario =
    (empresa as any).email_facturacion || empresa.email_contacto || (empresa.canal_config as any)?.email_notificacion;
  if (!destinatario) {
    return res.status(400).json({ error: "Esta empresa no tiene ningún email de contacto configurado" });
  }

  const { data: pdfDescargado, error: errorDescarga } = await supabase.storage
    .from("facturas-clientes")
    .download(recibo.pdf_path);

  if (errorDescarga || !pdfDescargado) {
    return res.status(500).json({ error: errorDescarga?.message ?? "No se pudo recuperar el PDF" });
  }

  try {
    const { transporte, remitente } = obtenerTransporteEmail();
    const pdfBuffer = Buffer.from(await pdfDescargado.arrayBuffer());
    await transporte.sendMail({
      from: remitente,
      to: destinatario,
      subject: `Factura ${recibo.numero_factura} — ${empresa.nombre}`,
      text: `Adjuntamos la factura ${recibo.numero_factura} correspondiente al periodo ${recibo.mes}/${recibo.anio}. Total: ${recibo.total} €.`,
      attachments: [{ filename: `${recibo.numero_factura}.pdf`, content: pdfBuffer }],
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }

  const { data: actualizado, error: errorUpdate } = await supabase
    .from("recibos")
    .update({ enviado_en: new Date().toISOString() })
    .eq("id", req.params.reciboId)
    .select()
    .single();

  if (errorUpdate) return res.status(500).json({ error: errorUpdate.message });
  res.json(actualizado);
});
