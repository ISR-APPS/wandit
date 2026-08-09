// Starts the worker process.
//
// This is not an HTTP server. It starts a Nest application context so BullMQ
// processors can run in the background.
//
// If this process is down, API requests can still enqueue jobs, but those jobs
// will wait until the worker is running again.
// Sentry must load before Nest/BullMQ so OpenTelemetry can patch them.
import "./instrument";
import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SentryNestLogger } from "@wandit/observability/nestjs-setup";

import { WorkerModule } from "./worker.module";

// Start Nest without opening an HTTP port.
async function bootstrap() {
	// WorkerModule registers processors, DB, queues, and Redis publisher.
	const app = await NestFactory.createApplicationContext(WorkerModule, {
		bufferLogs: true,
	});

	// Nest's default logger writes straight to stdout, invisible to Sentry —
	// this one mirrors warn/error to Sentry Logs (no-op without a DSN).
	app.useLogger(new SentryNestLogger());
	// Let Nest close Redis/database connections when the process stops.
	app.enableShutdownHooks();
	app.flushLogs();

	const logger = new Logger("Worker");
	logger.log("Worker process started");
}

void bootstrap();
