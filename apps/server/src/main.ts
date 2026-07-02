import "reflect-metadata";

import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { env } from "@wandit/env/server";

import { AppModule } from "./app.module";

async function bootstrap() {
	const adapter = new FastifyAdapter({
		logger: env.NODE_ENV !== "test",
	});

	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		adapter,
		{
			bufferLogs: true,
		},
	);

	app.enableShutdownHooks();
	app.setGlobalPrefix("api", {
		exclude: [{ path: "/", method: RequestMethod.GET }],
	});
	app.enableCors({
		origin: env.CORS_ORIGIN,
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
		maxAge: 86400,
	});
	app.useGlobalPipes(
		new ValidationPipe({
			forbidNonWhitelisted: true,
			transform: true,
			whitelist: true,
		}),
	);

	await app.listen({ host: "0.0.0.0", port: env.PORT });

	const logger = new Logger("Bootstrap");
	logger.log(`API listening on http://localhost:${env.PORT}`);
}

void bootstrap();
