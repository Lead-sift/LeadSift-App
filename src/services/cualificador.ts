import { anthropic, MODELOS } from "./anthropicClient.js";
import type { FichaLead } from "../types/lead.js";
import type { UsoTokens } from "./clasificador.js";
import type Anthropic from "@anthropic-ai/sdk";

const HERRAMIENTA_FICHA_LEAD: Anthropic.Tool = {
  name: "registrar_ficha_lead",
  description: "Registra la ficha estructurada extraída de la conversación con el cliente.",
  input_schema: {
    type: "object",
    properties: {
      nombreContacto: { type: ["string", "null"] },
      contacto: { type: ["string", "null"], description: "Email o teléfono del cliente" },
      necesidad: { type: ["string", "null"] },
      presupuestoEstimado: { type: ["string", "null"] },
      urgencia: { type: ["string", "null"], enum: ["alta", "media", "baja", null] },
      score: { type: "string", enum: ["caliente", "templado", "frio"] },
      requiereEscaladoHumano: { type: "boolean" },
      motivoEscalado: { type: ["string", "null"] },
      respuestaSugerida: { type: "string", description: "Respuesta a enviar al cliente" },
    },
    required: ["score", "requiereEscaladoHumano", "respuestaSugerida"],
  },
};

export interface ResultadoCualificacion {
  ficha: FichaLead;
  uso: UsoTokens;
}

export async function cualificarLead(
  promptSistema: string,
  mensajeCliente: string
): Promise<ResultadoCualificacion> {
  const respuesta = await anthropic.messages.create({
    model: MODELOS.cualificador,
    max_tokens: 1024,
    system: promptSistema,
    tools: [HERRAMIENTA_FICHA_LEAD],
    tool_choice: { type: "tool", name: "registrar_ficha_lead" },
    messages: [{ role: "user", content: mensajeCliente }],
  });

  const bloqueHerramienta = respuesta.content.find(
    (bloque): bloque is Anthropic.ToolUseBlock => bloque.type === "tool_use"
  );

  if (!bloqueHerramienta) {
    throw new Error("El modelo no devolvió una ficha de lead estructurada");
  }

  return {
    ficha: bloqueHerramienta.input as FichaLead,
    uso: {
      modelo: MODELOS.cualificador,
      tokensEntrada: respuesta.usage.input_tokens,
      tokensSalida: respuesta.usage.output_tokens,
    },
  };
}
