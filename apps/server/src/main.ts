/**
 * Starts the Nest API server.
 *
 * This is similar to `app.listen(...)` in Express, but Nest first builds the
 * whole application from modules, controllers, services, guards, and providers.
 */
// Required by Nest so decorators like `@Controller()` and `@Injectable()` work.
import "reflect-metadata";

import multipart from "@fastify/multipart";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { env } from "@wandit/env/server";

import { AppModule } from "./app.module";

// Runs once when the API process starts.
async function bootstrap() {
	// Nest can run on different HTTP engines. This app uses Fastify.
	const adapter = new FastifyAdapter({
		logger: env.NODE_ENV !== "test",
	});

	// Create the Nest app from AppModule. AppModule is the root wiring file.
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		adapter,
		{
			bufferLogs: true,
			rawBody: true,
		},
	);

	// Let Nest close resources like Redis/database connections on shutdown.
	app.enableShutdownHooks();
	// Add file upload support. The chat flow does not use this directly.
	await app.register(
		multipart as unknown as Parameters<NestFastifyApplication["register"]>[0],
		{
			limits: {
				fileSize: 15 * 1024 * 1024,
				files: 1,
			},
		},
	);
	// All API routes start with `/api`, for example `/api/v1/chats/...`.
	app.setGlobalPrefix("api", {
		exclude: [{ path: "/", method: RequestMethod.GET }],
	});
	// Allow the web app to call this API with cookies. `Last-Event-ID` is needed
	// so the SSE chat stream can reconnect and resume.
	app.enableCors({
		origin: env.CORS_ORIGIN,
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-Requested-With",
			"Last-Event-ID",
		],
		maxAge: 86400,
	});
	// Global validation for DTO classes. Some routes also use ZodValidationPipe.
	app.useGlobalPipes(
		new ValidationPipe({
			forbidNonWhitelisted: true,
			transform: true,
			whitelist: true,
		}),
	);

	// Start listening after all setup is ready.
	await app.listen({ host: "0.0.0.0", port: env.PORT });

	const logger = new Logger("Bootstrap");
	logger.log(`API listening on http://localhost:${env.PORT}`);
}

// Start the server. `void` means we intentionally do not await at top level.
void bootstrap();
