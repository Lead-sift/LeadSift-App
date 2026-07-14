import "dotenv/config";
import express from "express";
import { ingestaRouter } from "./routes/ingesta.js";

const app = express();
app.use(express.json());

app.use("/api/ingesta", ingestaRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
