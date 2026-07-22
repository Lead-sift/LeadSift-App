import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { ingestaRouter } from "./routes/ingesta.js";
import { revisionRouter } from "./routes/revision.js";
import { demoRouter } from "./routes/demo.js";
import { webhookWhatsappRouter } from "./routes/webhookWhatsapp.js";
import { empresasAdminRouter } from "./routes/admin/empresas.js";
import { promptsAdminRouter } from "./routes/admin/prompts.js";
import { kpisAdminRouter } from "./routes/admin/kpis.js";
import { canalesAdminRouter } from "./routes/admin/canales.js";
import { productosAdminRouter } from "./routes/admin/productos.js";
import { asistenteAdminRouter } from "./routes/admin/asistente.js";
import { consultasAdminRouter } from "./routes/admin/consultas.js";
import { extraccionesAdminRouter } from "./routes/admin/extracciones.js";
import { documentosAdminRouter } from "./routes/admin/documentos.js";
import { imagenesCatalogoAdminRouter } from "./routes/admin/imagenesCatalogo.js";
import { leadsAdminRouter } from "./routes/admin/leads.js";
import { usuariosAdminRouter } from "./routes/admin/usuarios.js";
import { paquetesAdminRouter } from "./routes/admin/paquetes.js";
import { portalRouter } from "./routes/portal/index.js";
import { authRouter } from "./routes/auth.js";
import { requiereInterno, requiereClientUser, requiereSesion, requiereRol } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Cabeceras de seguridad básicas. CSP permite scripts/estilos inline porque
// la web actual los usa directamente en los .html; si en el futuro se separan
// a ficheros .js/.css propios, se puede endurecer quitando 'unsafe-inline'.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        // Helmet restringe por defecto script-src-attr a 'none', lo que
        // bloquea silenciosamente cualquier onclick="..." aunque scriptSrc
        // permita 'unsafe-inline' — hay que igualarlo explícitamente.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Permite mostrar las imágenes del catálogo, alojadas en Supabase Storage.
        imgSrc: ["'self'", "data:", "https://*.supabase.co"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/ingesta", ingestaRouter);
app.use("/api/revision", revisionRouter);
app.use("/api/demo", demoRouter);
app.use("/api/webhooks/whatsapp", webhookWhatsappRouter);
app.use("/api/admin/empresas", requiereInterno, empresasAdminRouter);
app.use("/api/admin/prompts", requiereInterno, promptsAdminRouter);
app.use("/api/admin/kpis", requiereInterno, kpisAdminRouter);
app.use("/api/admin/canales", requiereInterno, canalesAdminRouter);
app.use("/api/admin/productos", requiereInterno, productosAdminRouter);
app.use("/api/admin/asistente", requiereInterno, asistenteAdminRouter);
app.use("/api/admin/consultas", requiereInterno, consultasAdminRouter);
app.use("/api/admin/extracciones", requiereInterno, extraccionesAdminRouter);
app.use("/api/admin/documentos", requiereInterno, documentosAdminRouter);
app.use("/api/admin/imagenes-catalogo", requiereInterno, imagenesCatalogoAdminRouter);
app.use("/api/admin/leads", requiereInterno, leadsAdminRouter);
app.use("/api/admin/usuarios", requiereRol("owner", "admin"), usuariosAdminRouter);
app.use("/api/admin/paquetes", requiereInterno, paquetesAdminRouter);
app.use("/api/portal", requiereClientUser, portalRouter);
app.use("/api/auth", authRouter);
app.get("/api/me", requiereSesion, (req, res) => res.json(req.perfil));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
