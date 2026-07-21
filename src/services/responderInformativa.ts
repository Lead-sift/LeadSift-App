import { anthropic, MODELOS } from "./anthropicClient.js";
import type { UsoTokens } from "./clasificador.js";

export interface ResultadoInformativa {
  respuesta: string;
  uso: UsoTokens;
}

// Respuesta de bajo riesgo (consulta informativa estándar: horarios, qué
// incluye el servicio, ubicación...). Se envía automáticamente sin pasar por
// la cola de revisión humana, porque no implica compromiso comercial ni dato
// sensible. Cualquier caso ambiguo lo captura ya el clasificador como
// lead_potencial o consulta_disponibilidad, que sí van siempre a revisión.
export async function generarRespuestaInformativa(
  promptSistema: string,
  mensajeCliente: string
): Promise<ResultadoInformativa> {
  const respuestaAnthropic = await anthropic.messages.create({
    model: MODELOS.cualificador,
    max_tokens: 512,
    system:
      promptSistema +
      "\n\nEste mensaje es una consulta informativa estándar, sin intención de compra clara. Responde de forma breve y útil usando solo la información del catálogo/FAQ anterior. No inventes datos que no estén ahí.",
    messages: [{ role: "user", content: mensajeCliente }],
  });

  const respuesta = respuestaAnthropic.content
    .filter((bloque) => bloque.type === "text")
    .map((bloque) => (bloque.type === "text" ? bloque.text : ""))
    .join("")
    .trim();

  return {
    respuesta,
    uso: {
      modelo: MODELOS.cualificador,
      tokensEntrada: respuestaAnthropic.usage.input_tokens,
      tokensSalida: respuestaAnthropic.usage.output_tokens,
    },
  };
}
