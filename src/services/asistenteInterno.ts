import { anthropic, MODELOS } from "./anthropicClient.js";
import { supabase } from "./supabaseClient.js";
import { calcularKpisEmpresas } from "./kpisService.js";
import type Anthropic from "@anthropic-ai/sdk";

// Herramientas de solo lectura, con consultas predefinidas — el modelo nunca
// genera SQL en crudo, para evitar cualquier riesgo de inyección o de que
// acceda a datos fuera de lo previsto.
const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "listar_kpis_empresas",
    description:
      "Devuelve los KPIs de todas las empresas cliente: consultas totales, por canal, por tipo de intención, tokens consumidos, coste estimado, última actividad y alerta de inactividad.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "buscar_leads",
    description: "Busca leads recientes, opcionalmente filtrando por nombre de empresa y/o score.",
    input_schema: {
      type: "object",
      properties: {
        nombreEmpresa: { type: ["string", "null"], description: "Nombre parcial de la empresa" },
        score: { type: ["string", "null"], enum: ["caliente", "templado", "frio", null] },
        limite: { type: "number", description: "Máximo de resultados, por defecto 20" },
      },
    },
  },
];

async function ejecutarHerramienta(nombre: string, input: any): Promise<unknown> {
  if (nombre === "listar_kpis_empresas") {
    return calcularKpisEmpresas();
  }

  if (nombre === "buscar_leads") {
    let consulta = supabase
      .from("leads")
      .select("necesidad, urgencia, score, created_at, empresas(nombre)")
      .order("created_at", { ascending: false })
      .limit(input?.limite ?? 20);

    if (input?.score) consulta = consulta.eq("score", input.score);

    const { data, error } = await consulta;
    if (error) return { error: error.message };

    const filtrado = input?.nombreEmpresa
      ? (data ?? []).filter((l: any) =>
          l.empresas?.nombre?.toLowerCase().includes(input.nombreEmpresa.toLowerCase())
        )
      : data;

    return filtrado;
  }

  return { error: `Herramienta desconocida: ${nombre}` };
}

const PROMPT_SISTEMA = `
Eres el asistente interno del panel de administración de LeadSift. Respondes preguntas del equipo sobre sus clientes y datos operativos (consultas, leads, consumo de tokens) usando las herramientas disponibles.

Reglas:
- Usa siempre las herramientas para obtener datos reales; nunca inventes cifras.
- Si una pregunta no se puede responder con las herramientas disponibles, dilo claramente.
- Responde de forma breve y directa, con las cifras concretas que pidan.
`.trim();

export async function preguntarAsistente(pregunta: string): Promise<string> {
  const mensajes: Anthropic.MessageParam[] = [{ role: "user", content: pregunta }];

  // Bucle agéntico: el modelo puede encadenar varias herramientas antes de
  // dar la respuesta final. Límite de 5 vueltas para evitar bucles infinitos.
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const respuesta = await anthropic.messages.create({
      model: MODELOS.cualificador,
      max_tokens: 1024,
      system: PROMPT_SISTEMA,
      tools: HERRAMIENTAS,
      messages: mensajes,
    });

    const bloquesHerramienta = respuesta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (bloquesHerramienta.length === 0) {
      return respuesta.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
    }

    mensajes.push({ role: "assistant", content: respuesta.content });

    const resultados = await Promise.all(
      bloquesHerramienta.map(async (bloque) => ({
        type: "tool_result" as const,
        tool_use_id: bloque.id,
        content: JSON.stringify(await ejecutarHerramienta(bloque.name, bloque.input)),
      }))
    );

    mensajes.push({ role: "user", content: resultados });
  }

  return "No he podido completar la respuesta en un número razonable de pasos.";
}
