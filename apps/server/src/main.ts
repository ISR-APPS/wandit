/**
 * Starts the Nest API server.
 *
 * This is similar to `app.listen(...)` in Express, but Nest first builds the
 * whole application from modules, controllers, services, guards, and providers.
 */
// Sentry must load before Nest/Fastify so OpenTelemetry can patch them.
import "./instrument";
// Required by Nest so decorators like `@Controller()` and `@Injectable()` work.
import "reflect-metadata";

import multipart from "@fastify/multipart";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { feedbackRoutes } from "@wandit/contracts";
import { corsWebOrigins } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
import { SentryNestLogger } from "@wandit/observability/nestjs-setup";

import { AppModule } from "./app.module";
import { publicLeadCaptureCorsOptions } from "./modules/leads/presentation/http/public-leads-cors";

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

	// Nest's default logger writes straight to stdout, invisible to Sentry —
	// this one mirrors warn/error to Sentry Logs (no-op without a DSN).
	app.useLogger(new SentryNestLogger());
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
	// The last-resort pagehide sendBeacon posts JSON as text/plain, capped by
	// the runtime below this parser's 16 KiB limit. The normal application/json
	// fetch is CORS-readable through the route-scoped policy below; lead capture
	// remains the only text/plain consumer.
	adapter
		.getInstance()
		.addContentTypeParser(
			"text/plain",
			{ bodyLimit: 16 * 1024, parseAs: "string" },
			(_request, body, done) => {
				done(null, body);
			},
		);
	// Fastify accepts 1 MiB of JSON by default, and every route keeps that limit
	// except feedback: its screenshot data URL alone can reach 2.6 MB. Nest
	// registers the controller routes in `app.init()`, which `app.listen()` calls
	// below, so this hook is in place before the feedback route is added.
	adapter.getInstance().addHook("onRoute", (route) => {
		const methods = Array.isArray(route.method) ? route.method : [route.method];

		if (methods.includes("POST") && route.url === feedbackRoutes.create) {
			route.bodyLimit = 4 * 1024 * 1024;
		}
	});
	// All API routes start with `/api`, for example `/api/v1/chats/...`.
	app.setGlobalPrefix("api", {
		exclude: [{ path: "/", method: RequestMethod.GET }],
	});
	// Allow the web app to call this API with cookies. `Last-Event-ID` is needed
	// so the SSE chat stream can reconnect and resume.
	const applicationCorsOptions = {
		// Production legitimately has two web origins: wandit.dev and
		// www.wandit.dev. CORS_ORIGIN stays canonical; extras add web aliases.
		origin: [
			...corsWebOrigins(env.CORS_ORIGIN, env.CORS_EXTRA_ORIGINS),
			env.ADMIN_ORIGIN,
		].filter((origin): origin is string => Boolean(origin)),
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-Requested-With",
			"Last-Event-ID",
			// Distributed tracing: the SPA's Sentry attaches these to API calls.
			// Missing from this whitelist = failed preflight = blocked request.
			"sentry-trace",
			"baggage",
			// Workspace scoping: the web injects this on every API call once
			// workspaces ship. Must be whitelisted BEFORE any web bundle sends it
			// or every cross-origin preflight fails.
			"x-wandit-workspace",
			// Cloudflare Turnstile token on the email-auth send endpoints. The
			// captcha plugin reads it from this header, so omitting it here
			// fails the preflight and blocks every email sign-in attempt.
			"x-captcha-response",
		],
		maxAge: 86400,
	};
	// Published pages may live on any merchant origin. Fastify's delegator sees
	// both the POST and its OPTIONS preflight; every other URL receives the
	// application/admin policy above unchanged.
	app.enableCors({
		delegator(request, callback) {
			callback(
				null,
				publicLeadCaptureCorsOptions(request.url) ?? applicationCorsOptions,
			);
		},
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
