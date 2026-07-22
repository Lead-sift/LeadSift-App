import { supabase } from "./supabaseClient.js";

export type CategoriaGestion = "factura" | "contrato" | "contrato_lopd" | "otros";

interface RegistrarEntradaOpciones {
  empresaId: string;
  categoria: CategoriaGestion;
  titulo: string;
  descripcion?: string | null;
  automatico?: boolean;
  creadoPor?: string | null;
  archivoBucket?: "gestion-clientes" | "facturas-clientes" | null;
  archivoPath?: string | null;
  archivoNombre?: string | null;
}

// Registra una entrada en la Ficha de Gestión del cliente (traza de
// documentos y notas). Se usa tanto para las entradas manuales (contrato,
// LOPD, factura, otros) como para los logs automáticos que dispara el
// propio sistema (cambios de datos, cambios de cuenta bancaria, facturas
// emitidas). No debe romper el flujo principal si falla el registro.
export async function registrarEntradaGestion(opciones: RegistrarEntradaOpciones) {
  const { error } = await supabase.from("gestion_entradas").insert({
    empresa_id: opciones.empresaId,
    categoria: opciones.categoria,
    automatico: opciones.automatico ?? false,
    titulo: opciones.titulo,
    descripcion: opciones.descripcion ?? null,
    creado_por: opciones.creadoPor ?? null,
    archivo_bucket: opciones.archivoBucket ?? null,
    archivo_path: opciones.archivoPath ?? null,
    archivo_nombre: opciones.archivoNombre ?? null,
  });

  if (error) {
    console.error("Error registrando entrada de gestión:", error);
  }
}
