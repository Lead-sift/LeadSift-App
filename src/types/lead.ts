export type Intencion =
  | "spam"
  | "informativa"
  | "lead_potencial"
  | "consulta_disponibilidad";

export type Urgencia = "alta" | "media" | "baja";

export type ScoreLead = "caliente" | "templado" | "frio";

export interface FichaLead {
  nombreContacto: string | null;
  contacto: string | null;
  necesidad: string | null;
  presupuestoEstimado: string | null;
  urgencia: Urgencia | null;
  score: ScoreLead;
  requiereEscaladoHumano: boolean;
  motivoEscalado: string | null;
  respuestaSugerida: string;
}

export interface Lead {
  id: string;
  conversacion_id: string;
  empresa_id: string;
  nombre_contacto: string | null;
  contacto: string | null;
  necesidad: string | null;
  presupuesto_estimado: string | null;
  urgencia: Urgencia | null;
  score: ScoreLead;
  notificado: boolean;
  created_at: string;
}
