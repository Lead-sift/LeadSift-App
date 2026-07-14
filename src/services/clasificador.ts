import { anthropic, MODELOS } from "./anthropicClient.js";
import type { Intencion } from "../types/lead.js";

const PROMPT_CLASIFICADOR = `
Clasifica el siguiente mensaje de un cliente en una de estas categorías exactas:
- spam: publicidad, contenido irrelevante o abusivo.
- informativa: pregunta general sin intención de compra clara (horarios, ubicación, curiosidad).
- lead_potencial: muestra intención de compra o solicita presupuesto/contacto comercial.

Responde ÚNICAMENTE con una de las tres palabras: spam, informativa o lead_potencial.
`.trim();

export async function clasificarIntencion(mensajeCliente: string): Promise<Intencion> {
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

  if (texto.includes("spam")) return "spam";
  if (texto.includes("lead_potencial")) return "lead_potencial";
  return "informativa";
}
