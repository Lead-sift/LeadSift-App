import { supabase } from "./supabaseClient.js";

const DIAS_INACTIVIDAD_ALERTA = 3;

export interface KpisEmpresa {
  empresaId: string;
  nombre: string;
  activo: boolean;
  totalConsultas: number;
  porCanal: Record<string, number>;
  porIntencion: Record<string, number>;
  tokensTotal: number;
  costoTotalEstimado: number;
  tokensPromedioPorConsulta: number;
  ultimaActividad: string | null;
  diasInactivo: number | null;
  alertaInactividad: boolean;
}

export async function calcularKpisEmpresas(): Promise<KpisEmpresa[]> {
  const { data: empresas } = await supabase.from("empresas").select("id, nombre, activo");

  const { data: conversaciones } = await supabase
    .from("conversaciones")
    .select("empresa_id, canal, intencion, created_at");

  const { data: consumo } = await supabase
    .from("consumo_tokens")
    .select("empresa_id, tokens_entrada, tokens_salida, costo_estimado");

  const ahora = Date.now();

  return (empresas ?? []).map((empresa) => {
    const conversacionesEmpresa = (conversaciones ?? []).filter((c) => c.empresa_id === empresa.id);
    const consumoEmpresa = (consumo ?? []).filter((c) => c.empresa_id === empresa.id);

    const porCanal: Record<string, number> = {};
    const porIntencion: Record<string, number> = {};
    let ultimaActividad: string | null = null;

    for (const c of conversacionesEmpresa) {
      porCanal[c.canal] = (porCanal[c.canal] ?? 0) + 1;
      if (c.intencion) porIntencion[c.intencion] = (porIntencion[c.intencion] ?? 0) + 1;
      if (!ultimaActividad || c.created_at > ultimaActividad) ultimaActividad = c.created_at;
    }

    const tokensTotal = consumoEmpresa.reduce((s, c) => s + c.tokens_entrada + c.tokens_salida, 0);
    const costoTotal = consumoEmpresa.reduce((s, c) => s + (c.costo_estimado ?? 0), 0);
    const totalConsultas = conversacionesEmpresa.length;

    const diasInactivo = ultimaActividad
      ? Math.floor((ahora - new Date(ultimaActividad).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      empresaId: empresa.id,
      nombre: empresa.nombre,
      activo: empresa.activo,
      totalConsultas,
      porCanal,
      porIntencion,
      tokensTotal,
      costoTotalEstimado: Number(costoTotal.toFixed(4)),
      tokensPromedioPorConsulta: totalConsultas ? Math.round(tokensTotal / totalConsultas) : 0,
      ultimaActividad,
      diasInactivo,
      alertaInactividad: diasInactivo !== null && diasInactivo >= DIAS_INACTIVIDAD_ALERTA,
    };
  });
}
