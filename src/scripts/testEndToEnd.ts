import "dotenv/config";
import { procesarMensajeEntrante } from "../services/procesarMensaje.js";
import { cargarPromptSistemaActivo } from "../services/cargarConfigEmpresa.js";

// Uso: EMPRESA_ID=<uuid de seedEmpresaEjemplo.ts> npm run test:e2e
async function main() {
  const empresaId = process.env.EMPRESA_ID;
  if (!empresaId) {
    throw new Error(
      "Define EMPRESA_ID con el id devuelto por seedEmpresaEjemplo.ts"
    );
  }

  const promptSistema = await cargarPromptSistemaActivo(empresaId);

  const mensajesDePrueba = [
    {
      empresaId,
      canal: "formulario" as const,
      remitenteContacto: "cliente.prueba@example.com",
      texto:
        "Hola, quería saber si tenéis descuentos por volumen para un pedido grande, es urgente porque empezamos obra la semana que viene. Mi teléfono es 600123456.",
    },
    {
      empresaId,
      canal: "email" as const,
      remitenteContacto: "curioso@example.com",
      texto: "Hola, ¿cuál es vuestro horario de atención?",
    },
  ];

  for (const mensaje of mensajesDePrueba) {
    console.log("\n--- Procesando mensaje ---");
    console.log(mensaje.texto);
    const resultado = await procesarMensajeEntrante(mensaje, promptSistema);
    console.log("Intención:", resultado.intencion);
    console.log("Resultado:", JSON.stringify(resultado, null, 2));
  }
}

main();
