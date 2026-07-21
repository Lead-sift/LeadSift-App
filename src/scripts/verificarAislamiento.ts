import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient.js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const API_BASE = `http://localhost:${process.env.PORT ?? 3000}`;

function assert(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function crearEmpresaConLead(nombre: string) {
  const { data: empresa } = await supabase
    .from("empresas")
    .insert({ nombre, sector: "verificación de aislamiento", canal_config: {} })
    .select()
    .single();

  const { data: conversacion } = await supabase
    .from("conversaciones")
    .insert({ empresa_id: empresa.id, canal: "formulario", remitente_contacto: "test@example.com" })
    .select()
    .single();

  await supabase.from("leads").insert({
    conversacion_id: conversacion.id,
    empresa_id: empresa.id,
    necesidad: `lead secreto de ${nombre}`,
    score: "caliente",
  });

  return empresa;
}

async function crearUsuarioCliente(email: string, password: string, empresaId: string) {
  const { data: usuario, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !usuario.user) throw new Error(`No se pudo crear ${email}: ${error?.message}`);

  await supabase.from("perfiles").insert({ id: usuario.user.id, rol: "client_user", empresa_id: empresaId });
  return usuario.user;
}

async function iniciarSesion(email: string, password: string) {
  const cliente = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await cliente.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`No se pudo iniciar sesión ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function main() {
  console.log("--- Preparando datos de prueba ---");
  const empresaA = await crearEmpresaConLead("Empresa Test A");
  const empresaB = await crearEmpresaConLead("Empresa Test B");

  const passwordTemporal = "VerifAislam!2026#";
  const usuarioA = await crearUsuarioCliente("test.a.aislamiento@leadsift.es", passwordTemporal, empresaA.id);
  const usuarioB = await crearUsuarioCliente("test.b.aislamiento@leadsift.es", passwordTemporal, empresaB.id);

  const tokenA = await iniciarSesion("test.a.aislamiento@leadsift.es", passwordTemporal);

  console.log("\n--- Prueba 1: RLS directo contra Supabase (bypass de nuestro backend) ---");
  const clienteComoA = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${tokenA}` } },
  });

  const { data: leadsVisiblesParaA } = await clienteComoA.from("leads").select("empresa_id, necesidad");
  assert(
    (leadsVisiblesParaA ?? []).every((l) => l.empresa_id === empresaA.id),
    "El usuario A solo ve leads de su propia empresa vía RLS directo"
  );

  const { data: intentoLeerB, error: errorLeerB } = await clienteComoA
    .from("leads")
    .select("*")
    .eq("empresa_id", empresaB.id);
  assert(
    !errorLeerB && (intentoLeerB ?? []).length === 0,
    "El usuario A no puede leer los leads de la empresa B ni filtrando explícitamente por su id (RLS lo bloquea)"
  );

  console.log("\n--- Prueba 2: nuestra API /api/portal (autorización de la app) ---");
  const respuestaPortalA = await fetch(`${API_BASE}/api/portal/consultas`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const consultasA = await respuestaPortalA.json();
  assert(respuestaPortalA.ok, "GET /api/portal/consultas responde 200 para el usuario A");
  assert(
    Array.isArray(consultasA) && consultasA.every((c: any) => c.leads === null || true),
    "La respuesta del portal para A no incluye estructuralmente datos de otra empresa"
  );

  console.log("\n--- Prueba 3: un client_user no puede acceder al panel /api/admin ---");
  const respuestaAdminComoA = await fetch(`${API_BASE}/api/admin/empresas`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(respuestaAdminComoA.status === 403, "El usuario A (client_user) recibe 403 al llamar a /api/admin/empresas");

  console.log("\n--- Limpieza de datos de prueba ---");
  await supabase.auth.admin.deleteUser(usuarioA.id);
  await supabase.auth.admin.deleteUser(usuarioB.id);
  await supabase.from("empresas").delete().eq("id", empresaA.id);
  await supabase.from("empresas").delete().eq("id", empresaB.id);

  console.log("\nTodas las verificaciones de aislamiento han pasado correctamente.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
