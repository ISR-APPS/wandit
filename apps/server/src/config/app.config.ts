import { registerAs } from "@nestjs/config";
import { env } from "@wandit/env/server";

export const appConfig = registerAs("app", () => ({
	corsOrigin: env.CORS_ORIGIN,
	nodeEnv: env.NODE_ENV,
	port: env.PORT,
}));
