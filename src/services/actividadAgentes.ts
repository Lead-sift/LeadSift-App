import { randomUUID } from "node:crypto";

// Registro en memoria (no persistido) de los mensajes que el motor de IA
// está procesando ahora mismo. Vive solo mientras el proceso Node esté
// arrancado — es intencionadamente efímero, no es un log de auditoría.
interface ActividadEnCurso {
  id: string;
  empresaId: string;
  canal: string;
  etapa: string;
  inicio: number;
}

const enCurso = new Map<string, ActividadEnCurso>();

export function iniciarActividad(empresaId: string, canal: string): string {
  const id = randomUUID();
  enCurso.set(id, { id, empresaId, canal, etapa: "clasificando", inicio: Date.now() });
  return id;
}

export function actualizarEtapaActividad(id: string, etapa: string) {
  const actividad = enCurso.get(id);
  if (actividad) actividad.etapa = etapa;
}

export function finalizarActividad(id: string) {
  enCurso.delete(id);
}

export function obtenerActividadEnCurso() {
  return [...enCurso.values()].map((a) => ({
    ...a,
    segundos: Math.round((Date.now() - a.inicio) / 1000),
  }));
}
