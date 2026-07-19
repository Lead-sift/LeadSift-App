import nodemailer from "nodemailer";

let transporte: nodemailer.Transporter | null = null;

// Carga perezosa: si faltan las credenciales, el servidor sigue arrancando
// con normalidad (el email de notificación es una funcionalidad opcional,
// no debe tumbar el resto de la app si aún no se ha configurado).
//
// Usa SMTP genérico (no un proveedor concreto como Gmail) porque el correo
// corporativo (administracion@leadsift.es) está alojado en DonDominio, el
// mismo registrador del dominio, no en Google Workspace.
export function obtenerTransporteEmail(): { transporte: nodemailer.Transporter; remitente: string } {
  const user = process.env.EMAIL_NOTIFICACIONES_USER;
  const password = process.env.EMAIL_NOTIFICACIONES_PASSWORD;
  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;

  if (!user || !password || !host || !port) {
    throw new Error(
      "Faltan EMAIL_NOTIFICACIONES_USER, EMAIL_NOTIFICACIONES_PASSWORD, EMAIL_SMTP_HOST o EMAIL_SMTP_PORT en el entorno"
    );
  }

  if (!transporte) {
    const puertoNumero = Number(port);
    transporte = nodemailer.createTransport({
      host,
      port: puertoNumero,
      secure: puertoNumero === 465, // 465 = SSL directo; 587 = STARTTLS
      auth: { user, pass: password },
    });
  }

  return { transporte, remitente: user };
}
