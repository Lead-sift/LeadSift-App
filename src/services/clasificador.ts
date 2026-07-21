import { anthropic, MODELOS } from "./anthropicClient.js";
import type { Intencion } from "../types/lead.js";

const PROMPT_CLASIFICADOR = `
Clasifica el siguiente mensaje de un cliente en una de estas categorías exactas:
- spam: publicidad, contenido irrelevante o abusivo.
- informativa: pregunta general sin intención de compra clara (qué incluye el servicio, ubicación, condiciones, curiosidad).
- consulta_disponibilidad: el cliente pregunta si hay disponibilidad para una fecha/franja horaria concreta (con o sin intención de compra explícita). Cualquier mención de un día, fecha o "¿tenéis libre...?" entra aquí, incluso si el resto del mensaje es breve.
- lead_potencial: muestra intención de compra o solicita presupuesto/contacto comercial, sin ser específicamente una pregunta de disponibilidad de fecha.

Responde ÚNICAMENTE con una de estas palabras: spam, informativa, consulta_disponibilidad o lead_potencial.
`.trim();

export interface UsoTokens {
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
}

export interface ResultadoClasificacion {
  intencion: Intencion;
  uso: UsoTokens;
}

export async function clasificarIntencion(mensajeCliente: string): Promise<ResultadoClasificacion> {
  const respuesta = await anthropic.messages.create({
    model: MODELOS.clasificador,
    max_tokens: 10,
    system: PROMPT_CLASIFICADOR,
    messages: [{ role: "user", content: mensajeCliente }],
  });

  const texto = respuesta.content
    .filter((bloque) => bloque.type === "text")
    .map((bloque) => (bloque.type === "text" ? bloque.text : ""))
    .join("")
    .trim()
    .toLowerCase();

  let intencion: Intencion = "informativa";
  if (texto.includes("spam")) intencion = "spam";
  else if (texto.includes("consulta_disponibilidad")) intencion = "consulta_disponibilidad";
  else if (texto.includes("lead_potencial")) intencion = "lead_potencial";

  return {
    intencion,
    uso: {
      modelo: MODELOS.clasificador,
      tokensEntrada: respuesta.usage.input_tokens,
      tokensSalida: respuesta.usage.output_tokens,
    },
  };
}
