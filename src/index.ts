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
import { portalRouter } from "./routes/portal/index.js";
import { requiereInterno, requiereClientUser } from "./middleware/auth.js";

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
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
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
app.use("/api/portal", requiereClientUser, portalRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
