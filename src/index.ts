import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { ingestaRouter } from "./routes/ingesta.js";
import { revisionRouter } from "./routes/revision.js";
import { demoRouter } from "./routes/demo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/ingesta", ingestaRouter);
app.use("/api/revision", revisionRouter);
app.use("/api/demo", demoRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
