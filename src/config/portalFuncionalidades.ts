// Catálogo de pestañas y acciones previstas para el futuro "portal de
// agente" (el panel donde el comercial/contacto de cada empresa cliente
// gestionará sus propios leads). El portal en sí todavía no está
// construido — este catálogo define de antemano qué existirá, para que se
// pueda perfilar por usuario externo (client_user) desde Usuarios/Roles,
// antes de que el portal exista.
//
// Modelo "opt-out": todas las claves están habilitadas por defecto; solo
// hace falta guardar una fila en portal_permisos cuando se quiere
// desactivar una para un usuario concreto.

export interface AccionPortal {
  clave: string;
  etiqueta: string;
}

export interface PestanaPortal {
  clave: string;
  etiqueta: string;
  descripcion: string;
  acciones: AccionPortal[];
}

export const CATALOGO_PORTAL: PestanaPortal[] = [
  {
    clave: "resumen",
    etiqueta: "Resumen",
    descripcion: "KPIs propios: leads del mes, tokens consumidos, estado de los canales.",
    acciones: [{ clave: "resumen.ver", etiqueta: "Ver resumen" }],
  },
  {
    clave: "leads",
    etiqueta: "Leads",
    descripcion: "Bandeja de conversaciones y leads entrantes propios.",
    acciones: [
      { clave: "leads.ver", etiqueta: "Ver listado de leads" },
      { clave: "leads.ver_conversacion", etiqueta: "Ver conversación completa" },
      { clave: "leads.responder_manual", etiqueta: "Responder manualmente" },
      { clave: "leads.pausar_bot", etiqueta: "Pausar/reanudar el bot de esa conversación" },
      { clave: "leads.marcar_resultado", etiqueta: "Marcar resultado (confirmado/desestimado)" },
    ],
  },
  {
    clave: "canales",
    etiqueta: "Canales",
    descripcion: "Estado y pausa de sus propios canales (formulario, WhatsApp).",
    acciones: [
      { clave: "canales.ver", etiqueta: "Ver estado de los canales" },
      { clave: "canales.pausar", etiqueta: "Pausar/reanudar un canal completo" },
    ],
  },
  {
    clave: "documentos",
    etiqueta: "Documentos",
    descripcion: "Contratos, LOPD y otros documentos de su Ficha de Gestión.",
    acciones: [
      { clave: "documentos.ver", etiqueta: "Ver listado de documentos" },
      { clave: "documentos.descargar", etiqueta: "Descargar documento" },
    ],
  },
  {
    clave: "facturacion",
    etiqueta: "Facturación",
    descripcion: "Recibos y facturas propias.",
    acciones: [
      { clave: "facturacion.ver", etiqueta: "Ver recibos/facturas" },
      { clave: "facturacion.descargar", etiqueta: "Descargar factura en PDF" },
    ],
  },
];

export function todasLasClaves(): string[] {
  return CATALOGO_PORTAL.flatMap((pestana) => pestana.acciones.map((a) => a.clave));
}
