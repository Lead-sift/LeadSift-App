import nodemailer from "nodemailer";

let transporte: nodemailer.Transporter | null = null;

// Carga perezosa: si faltan las credenciales, el servidor sigue arrancando
// con normalidad (el email de notificación es una funcionalidad opcional,
// no debe tumbar el resto de la app si aún no se ha configurado).
export function obtenerTransporteEmail(): { transporte: nodemailer.Transporter; remitente: string } {
  const user = process.env.EMAIL_NOTIFICACIONES_USER;
  const appPassword = process.env.EMAIL_NOTIFICACIONES_APP_PASSWORD;

  if (!user || !appPassword) {
    throw new Error(
      "Faltan EMAIL_NOTIFICACIONES_USER o EMAIL_NOTIFICACIONES_APP_PASSWORD en el entorno"
    );
  }

  if (!transporte) {
    transporte = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: appPassword },
    });
  }

  return { transporte, remitente: user };
}
