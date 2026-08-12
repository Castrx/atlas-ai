import { env } from "./config/env";
import { createApp } from "./app";
import { logger } from "./utils/logger";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Atlas AI backend ouvindo na porta ${env.PORT}`, {
    env: env.NODE_ENV,
  });
});
