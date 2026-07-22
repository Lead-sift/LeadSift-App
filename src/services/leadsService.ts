const HORAS_PARA_CONGELAR = 48;

export type EstadoLead = "en_curso" | "congelado" | "finalizado";

// El estado nunca se guarda como columna: se calcula a partir de si ya hay
// un resultado (confirmado/desestimado/spam) y de cuánto hace de la última
// actividad real de la conversación.
export function calcularEstado(resultado: string | null, ultimaActividad: string): EstadoLead {
  if (resultado) return "finalizado";

  const horasDesdeActividad = (Date.now() - new Date(ultimaActividad).getTime()) / (1000 * 60 * 60);
  return horasDesdeActividad >= HORAS_PARA_CONGELAR ? "congelado" : "en_curso";
}

export const MOTIVOS_DESESTIMACION = [
  "No hay presupuesto",
  "No es el momento / sin urgencia",
  "Ya trabaja con otro proveedor",
  "El producto o servicio no se ajusta a su necesidad",
  "Fuera de zona de cobertura",
  "No responde / se pierde el contacto",
  "Precio",
  "Otro",
];
