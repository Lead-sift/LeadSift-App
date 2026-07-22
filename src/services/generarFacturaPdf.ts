import PDFDocument from "pdfkit";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function euros(valor: number | null | undefined): string {
  return `${Number(valor ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export interface DatosFacturaEmpresa {
  nombre: string;
  nif_cif_nie: string | null;
  codigo_cliente: string | null;
  tipo_via: string | null;
  nombre_via: string | null;
  numero_via: string | null;
  municipio: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  cuenta_facturacion: string | null;
}

export interface DatosFacturaRecibo {
  numero_factura: string;
  anio: number;
  mes: number;
  paquete_nombre: string | null;
  metodo_facturacion: string | null;
  coste_implementacion: number;
  incluye_implementacion: boolean;
  precio_por_lead: number | null;
  coste_mensual: number | null;
  leads_incluidos_mes: number | null;
  precio_lead_adicional: number | null;
  leads_contados: number;
  leads_exceso: number;
  total: number;
}

// Datos del emisor configurables por entorno: la S.L. (Tamiz Comercial)
// todavía no tiene CIF asignado (alta en curso), así que se deja un
// placeholder explícito hasta que EMISOR_NIF se rellene en producción.
const EMISOR = {
  nombre: process.env.EMISOR_NOMBRE ?? "LeadSift — Tamiz Comercial, S.L.",
  nif: process.env.EMISOR_NIF ?? "NIF pendiente de alta",
  direccion: process.env.EMISOR_DIRECCION ?? "",
};

export function generarFacturaPdf(empresa: DatosFacturaEmpresa, recibo: DatosFacturaRecibo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const trozos: Buffer[] = [];
    doc.on("data", (trozo) => trozos.push(trozo));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);

    doc.fontSize(20).text(EMISOR.nombre, { align: "left" });
    doc.fontSize(10).fillColor("#555").text(`NIF: ${EMISOR.nif}`);
    if (EMISOR.direccion) doc.text(EMISOR.direccion);
    doc.moveDown(1.5);

    doc.fontSize(16).fillColor("#000").text(`Factura ${recibo.numero_factura}`, { align: "right" });
    doc.fontSize(10).fillColor("#555").text(`Periodo: ${NOMBRES_MES[recibo.mes - 1]} ${recibo.anio}`, { align: "right" });
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-ES")}`, { align: "right" });
    doc.moveDown(1.5);

    doc.fontSize(12).fillColor("#000").text("Cliente", { underline: true });
    doc.fontSize(10).fillColor("#333");
    doc.text(empresa.nombre);
    if (empresa.nif_cif_nie) doc.text(`NIF/CIF/NIE: ${empresa.nif_cif_nie}`);
    if (empresa.codigo_cliente) doc.text(`Código de cliente: ${empresa.codigo_cliente}`);
    const direccion = [empresa.tipo_via, empresa.nombre_via, empresa.numero_via].filter(Boolean).join(" ");
    if (direccion) doc.text(direccion);
    const localidad = [empresa.codigo_postal, empresa.municipio, empresa.provincia].filter(Boolean).join(" ");
    if (localidad) doc.text(localidad);
    doc.moveDown(1.5);

    doc.fontSize(12).fillColor("#000").text("Concepto", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#333");
    doc.text(`Paquete: ${recibo.paquete_nombre ?? "—"}`);
    doc.text(
      `Método de facturación: ${recibo.metodo_facturacion === "lead" ? "Precio por lead" : "Suscripción mensual"}`
    );

    if (recibo.metodo_facturacion === "lead") {
      doc.text(`Leads cualificados en el periodo: ${recibo.leads_contados}`);
      doc.text(`Precio por lead: ${euros(recibo.precio_por_lead)}`);
      doc.text(`Subtotal por leads: ${euros(recibo.leads_contados * Number(recibo.precio_por_lead ?? 0))}`);
    } else {
      doc.text(`Cuota mensual (${recibo.leads_incluidos_mes ?? 0} leads incluidos): ${euros(recibo.coste_mensual)}`);
      if (recibo.leads_exceso > 0) {
        doc.text(`Leads adicionales sobre el cupo: ${recibo.leads_exceso}`);
        doc.text(`Precio por lead adicional: ${euros(recibo.precio_lead_adicional)}`);
        doc.text(`Subtotal exceso: ${euros(recibo.leads_exceso * Number(recibo.precio_lead_adicional ?? 0))}`);
      }
    }

    if (recibo.incluye_implementacion) {
      doc.text(`Coste de implementación y conexión (pago único): ${euros(recibo.coste_implementacion)}`);
    }

    doc.moveDown(1);
    doc.fontSize(14).fillColor("#000").text(`Total: ${euros(recibo.total)}`, { align: "right" });

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#888").text(
      "Documento generado automáticamente por LeadSift. La domiciliación bancaria del cobro se activará próximamente.",
      { align: "center" }
    );

    doc.end();
  });
}
