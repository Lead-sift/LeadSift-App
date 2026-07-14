import "dotenv/config";
import { procesarMensajeEntrante } from "../services/procesarMensaje.js";
import { espaiLaLira } from "../prompts/plantillaBase.js";

// Uso: EMPRESA_ID=<uuid de seedEspaiLaLira.ts> npm run test:espailalira
async function main() {
  const empresaId = process.env.EMPRESA_ID;
  if (!empresaId) {
    throw new Error("Define EMPRESA_ID con el id devuelto por seedEspaiLaLira.ts");
  }

  const mensajesDePrueba = [
    {
      empresaId,
      canal: "formulario" as const,
      remitenteContacto: "mama.cumple@example.com",
      texto:
        "Hola! Quiero reservar la sala para el cumpleaños de mi hija, seríamos unos 20 niños y algunos padres, sería un sábado por la tarde. ¿Qué precio tendría y qué incluye?",
    },
    {
      empresaId,
      canal: "whatsapp" as const,
      remitenteContacto: "+34600111222",
      texto:
        "Bon dia, estem organitzant una boda petita i voldríem llogar l'espai per unes 85 persones, es podria fer un dissabte a la nit?",
    },
    {
      empresaId,
      canal: "email" as const,
      remitenteContacto: "curioso@example.com",
      texto: "Hola, ¿el precio de la tarde entre semana incluye el uso de la cocina?",
    },
    {
      empresaId,
      canal: "whatsapp" as const,
      remitenteContacto: "+34600333444",
      texto: "Hola, ¿tenéis libre el sábado 15 de agosto por la tarde?",
    },
  ];

  for (const mensaje of mensajesDePrueba) {
    console.log("\n--- Procesando mensaje ---");
    console.log(mensaje.texto);
    const resultado = await procesarMensajeEntrante(mensaje, espaiLaLira);
    console.log("Intención:", resultado.intencion);
    console.log("Resultado:", JSON.stringify(resultado, null, 2));
  }
}

main();
