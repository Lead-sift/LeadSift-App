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
