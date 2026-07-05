import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { WorkerModule } from "./worker.module";

async function bootstrap() {
	const app = await NestFactory.createApplicationContext(WorkerModule, {
		bufferLogs: true,
	});

	app.enableShutdownHooks();
	app.flushLogs();

	const logger = new Logger("Worker");
	logger.log("Worker process started");
}

void bootstrap();
