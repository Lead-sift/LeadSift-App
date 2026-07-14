export interface ConfigEmpresa {
  nombre: string;
  sector: string;
  tono: string;
  idioma: string;
  catalogoOFaq: string;
  reglasEscalado: string;
}

// Placeholder de una empresa genérica de tipo "instalador/distribuidor con
// catálogo de producto", para probar el flujo end-to-end antes de tener
// el sector real decidido por la auditoría.
export const empresaEjemplo: ConfigEmpresa = {
  nombre: "Ejemplo Instalaciones SL",
  sector: "instalador de producto técnico (placeholder)",
  tono: "cercano y profesional, tuteo",
  idioma: "es y ca según el idioma del cliente",
  catalogoOFaq: `
- Servicios: instalación, mantenimiento y presupuesto a medida.
- Horario de atención: L-V 9:00-18:00.
- Zona de cobertura: provincia de Barcelona.
- Plazo de respuesta habitual a presupuestos: 48h laborables.
`.trim(),
  reglasEscalado: `
- Escalar a humano si el cliente muestra queja, enfado o menciona una reclamación.
- Escalar a humano si pregunta por descuentos, condiciones de pago a medida o negociación de precio.
- No escalar si es una consulta informativa estándar (horarios, zona de cobertura, plazos).
`.trim(),
};

// Cliente de prueba real: Espai la Lira (espailalira.com), sala de alquiler
// para fiestas infantiles y celebraciones en Montornès del Vallès (Barcelona).
// Datos extraídos de la web pública en julio 2026 — revisar y actualizar si
// cambian tarifas o condiciones.
export const espaiLaLira: ConfigEmpresa = {
  nombre: "Espai la Lira",
  sector: "alquiler de sala de fiestas para celebraciones (cumpleaños, fiestas infantiles, eventos)",
  tono: "cercano y familiar, tuteo, en el estilo de un negocio local de confianza",
  idioma: "detecta si el cliente escribe en catalán o castellano y responde en ese mismo idioma",
  catalogoOFaq: `
- Ubicación: Cruïlla de la Rambla Sant Sadurní amb Passatge del Teatre, Montornès del Vallès (Barcelona).
- Contacto: WhatsApp/teléfono 609 823 938, o formulario web.
- Capacidad: 190 m², aforo aproximado de 90 personas.
- Tipos de evento: fiestas infantiles, cumpleaños, comuniones, celebraciones con servicio de mesa (desayuno/comida/merienda/cena), eventos de empresa.

Tarifas por franja horaria:
- Mañana (09:30-14:30): 80€ entre semana y viernes/víspera festivo, 160€ sábados/domingos/festivos.
- Tarde (15:30-20:30): 100€ entre semana, 150€ viernes/víspera festivo, 160€ fin de semana/festivo.
- Noche (21:30-02:30): no disponible de lunes a jueves; 220€ viernes/víspera y fines de semana.
- Ampliación de horario nocturno (02:30-05:30): 60€ extra (no disponible entre semana).
- Paquetes combinados: mañana+tarde 150-300€ según día; tarde+noche 320-340€; mañana+tarde+noche 370-420€ según día.

Qué incluye el alquiler:
- Mobiliario: 60 sillas, 11 mesas, 2 tronos, 2 sofás.
- Equipo de música, proyector, Chromecast, bola de discoteca LED, wifi.
- Cocina: frigoríficos, microondas, cafetera.
- Climatización (aire acondicionado y calefacción).
- Zona infantil: parque con piscina de bolas, zona de juegos, futbolín gratuito.
- Bolsas de basura y útiles de limpieza básica (el cliente debe dejar la sala recogida; la limpieza profunda la hace el local).

Servicios adicionales NO incluidos en el precio (se contratan aparte, con proveedores externos recomendados por Espai la Lira, sin precio fijo publicado — consultar disponibilidad):
- Catering: Pastelería Viñallonga, Mi Rincón Dulce (tartas y mesas dulces).
- Animación/DJ: DJ Wateke, DJ Marc.
- Fotomatón: Gaudir Photos.
- Decoración (globos, piñatas): Piñatas Barcelona.

Reserva y cancelación:
- Para reservar: contactar por WhatsApp o llamada al 609 823 938.
- Señal de reserva: 50€.
- El resto del importe se paga el día del evento.
- Cancelación con más de 15 días naturales de antelación: se devuelve la señal. Con menos de 15 días: no se devuelve.
- Eventos nocturnos: depósito adicional de 100€, reembolsable.

Normas del espacio:
- Prohibido confeti fuera de zonas designadas.
- Respetar el descanso de los vecinos (especialmente en horario nocturno).
- Aparcamiento solo para carga y descarga.
`.trim(),
  reglasEscalado: `
- Escalar a humano si el cliente muestra queja, enfado o menciona una reclamación.
- Escalar a humano si pregunta por descuentos o condiciones de pago fuera de lo indicado (negociación de precio).
- Escalar a humano si el evento es de aforo grande (cerca del máximo de 90 personas), es una boda, evento corporativo, o cualquier celebración fuera del uso habitual de fiesta infantil/cumpleaños estándar.
- Escalar a humano si la fecha del evento genera dudas de disponibilidad real (la IA no tiene acceso al calendario de reservas en tiempo real).
- No escalar si es una consulta informativa estándar (tarifas, qué incluye el alquiler, ubicación, servicios adicionales recomendados).
`.trim(),
};

export function construirPromptSistema(config: ConfigEmpresa): string {
  return `
Eres el asistente de atención comercial de "${config.nombre}", una empresa del sector: ${config.sector}.

Tono de comunicación: ${config.tono}.
Idioma: responde siempre en el idioma en que escribe el cliente (${config.idioma}).

Información de la empresa (catálogo/FAQ):
${config.catalogoOFaq}

Reglas de escalado a un humano:
${config.reglasEscalado}

Tu objetivo en cada conversación:
1. Determinar si el cliente tiene una necesidad comercial real (interesado) o solo pide información general.
2. Si está interesado, extraer: nombre de contacto, forma de contacto (email/teléfono), necesidad concreta, presupuesto orientativo si lo menciona, y nivel de urgencia.
3. Responder de forma útil y breve, y si corresponde, informar de que un comercial se pondrá en contacto.

No inventes información que no esté en el catálogo/FAQ anterior. Si no lo sabes, dilo y ofrece derivar a un humano.
`.trim();
}
