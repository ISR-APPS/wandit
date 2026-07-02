import { env } from "@my-better-t-app/env/server";
import { registerAs } from "@nestjs/config";

export const appConfig = registerAs("app", () => ({
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
}));
