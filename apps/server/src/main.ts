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
import {
	aiChatRoutes,
	appBuilderRoutes,
	feedbackRoutes,
	mcpRoutes,
} from "@wandit/contracts";
import { corsWebOrigins } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
import { SentryNestLogger } from "@wandit/observability/nestjs-setup";
import { errorCodes } from "fastify";

import { AppModule } from "./app.module";
import {
	isOAuthFormBodyPath,
	OAUTH_FORM_BODY_LIMIT_BYTES,
	oauthMetadataCorsOptions,
} from "./modules/auth";
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
	// except feedback: its screenshot data URL alone can reach 2.6 MB. The V2
	// LLM proxy routes get 4 MiB too: a builder prompt with cache_control
	// blocks can exceed 1 MiB. The app AI gateway route gets 4 MiB too: an app
	// sends images as data URLs. The V1 AI chat stream gets 4 MiB too. The web
	// and native apps send the full chat history with each message, and long
	// chats pass 1 MiB. Nest registers the controller routes in
	// `app.init()`, which `app.listen()` calls below, so this hook is in place
	// before the routes are added.
	// LIMIT: a chat above 4 MiB still gets 413. Upgrade: the server builds the
	// history from the database (branch feat/v1-chat-compaction).
	adapter.getInstance().addHook("onRoute", (route) => {
		const methods = Array.isArray(route.method) ? route.method : [route.method];
		const isLargeBodyRoute =
			route.url === feedbackRoutes.create ||
			route.url === appBuilderRoutes.llmProxyMessages ||
			route.url === appBuilderRoutes.llmProxyCountTokens ||
			route.url === appBuilderRoutes.appAiChatCompletions ||
			// Fastify reports the route pattern, so the constant gets the param name.
			route.url === aiChatRoutes.stream(":chatId");

		if (methods.includes("POST") && isLargeBodyRoute) {
			route.bodyLimit = 4 * 1024 * 1024;
		}
		// MCP `apply_changes` sends up to 2 MiB of file text. JSON escaping and the
		// JSON-RPC envelope add to it, so the route gets 3 MiB.
		if (methods.includes("POST") && route.url === mcpRoutes.endpoint) {
			route.bodyLimit = 3 * 1024 * 1024;
		}
	});
	// All API routes start with `/api`, for example `/api/v1/chats/...`.
	// RFC 9728 and RFC 8414 fix the OAuth metadata paths at the origin root.
	app.setGlobalPrefix("api", {
		exclude: [
			{ path: "/", method: RequestMethod.GET },
			{ path: mcpRoutes.protectedResourceMetadata, method: RequestMethod.GET },
			{
				path: mcpRoutes.protectedResourceMetadataRoot,
				method: RequestMethod.GET,
			},
			{
				path: mcpRoutes.authorizationServerMetadata,
				method: RequestMethod.GET,
			},
		],
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
		exposedHeaders: ["Content-Disposition"],
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
	// both the POST and its OPTIONS preflight. A browser MCP client on any origin
	// reads the OAuth metadata. Every other URL receives the application/admin
	// policy above unchanged.
	app.enableCors({
		delegator(request, callback) {
			callback(
				null,
				publicLeadCaptureCorsOptions(request.url) ??
					oauthMetadataCorsOptions(request.url) ??
					applicationCorsOptions,
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
	// Hardening headers for the API host (the web apps get theirs from
	// vercel.json). HSTS only where TLS terminates for real.
	const hstsEnabled = new URL(env.BETTER_AUTH_URL).protocol === "https:";
	adapter.getInstance().addHook("onSend", (_request, reply, payload, done) => {
		reply.header("X-Content-Type-Options", "nosniff");
		if (hstsEnabled) {
			reply.header(
				"Strict-Transport-Security",
				"max-age=31536000; includeSubDomains",
			);
		}
		done(null, payload);
	});

	// `app.init()` is where Nest registers its default body parsers and routes.
	// Nest adds an application/x-www-form-urlencoded parser that nothing here
	// needs. Every client sends JSON, multipart for uploads, or text/plain for
	// the lead beacon. From a browser page, only a cross-site <form> that forges
	// a write sends urlencoded. So drop the parser: Fastify then answers 415
	// before any handler runs. This protection does not depend on the Origin guard.
	await app.init();
	const fastify = adapter.getInstance();
	if (fastify.hasContentTypeParser("application/x-www-form-urlencoded")) {
		fastify.removeContentTypeParser("application/x-www-form-urlencoded");
	}
	// OAuth clients must POST the token, revoke, and introspect forms as
	// urlencoded (RFC 6749). Only those exact paths get the body, as a string
	// that the Better Auth forwarder passes on unchanged. Any other path still
	// gets 415 (or 413 above the 16 KiB limit), and no handler runs.
	if (env.V2_BUILDER_ENABLED) {
		fastify.addContentTypeParser(
			"application/x-www-form-urlencoded",
			{ bodyLimit: OAUTH_FORM_BODY_LIMIT_BYTES, parseAs: "string" },
			(request, body, done) => {
				if (isOAuthFormBodyPath(request.url)) {
					done(null, body);
					return;
				}
				done(new errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE(), undefined);
			},
		);
	}

	// Start listening after all setup is ready.
	await app.listen({ host: "0.0.0.0", port: env.PORT });

	const logger = new Logger("Bootstrap");
	logger.log(`API listening on http://localhost:${env.PORT}`);
}

// Start the server. `void` means we intentionally do not await at top level.
void bootstrap();
