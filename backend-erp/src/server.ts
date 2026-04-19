import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`[server] Ejecutándose en http://localhost:${env.PORT}`);
  console.log(`[server] Entorno: ${env.NODE_ENV}`);
});
