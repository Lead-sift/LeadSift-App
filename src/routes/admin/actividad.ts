import { Router } from "express";
import { supabase } from "../../services/supabaseClient.js";
import { obtenerActividadEnCurso } from "../../services/actividadAgentes.js";

export const actividadAdminRouter = Router();

async function contarMensajesDesde(fecha: Date): Promise<number> {
  const { count } = await supabase
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .eq("origen", "cliente")
    .gte("created_at", fecha.toISOString());
  return count ?? 0;
}

actividadAdminRouter.get("/", async (_req, res) => {
  const enCurso = obtenerActividadEnCurso();

  const empresaIds = [...new Set(enCurso.map((a) => a.empresaId))];
  const { data: empresas } = empresaIds.length
    ? await supabase.from("empresas").select("id, nombre").in("id", empresaIds)
    : { data: [] };
  const mapaNombres = new Map((empresas ?? []).map((e) => [e.id, e.nombre]));

  const ahora = Date.now();
  const [ultimos5min, ultimaHora, ultimas24h] = await Promise.all([
    contarMensajesDesde(new Date(ahora - 5 * 60 * 1000)),
    contarMensajesDesde(new Date(ahora - 60 * 60 * 1000)),
    contarMensajesDesde(new Date(ahora - 24 * 60 * 60 * 1000)),
  ]);

  res.json({
    enCurso: enCurso.map((a) => ({ ...a, empresaNombre: mapaNombres.get(a.empresaId) ?? "—" })),
    ultimos5min,
    ultimaHora,
    ultimas24h,
  });
});
