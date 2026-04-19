import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// ─── Seguridad y utilidades ──────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.NODE_ENV === "production" ? false : "http://localhost:5173",
    credentials: true,
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());

// ─── Rutas ───────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", apiRouter);

// ─── Manejo de errores ───────────────────────────────────────
app.use(errorHandler);

export { app };
