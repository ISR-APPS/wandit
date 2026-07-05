import { Module, type Provider } from "@nestjs/common";
import { createDb } from "@wandit/db";

import { WORKER_DATABASE, type WorkerDatabase } from "./database.constants";

const workerDatabaseProvider: Provider<WorkerDatabase> = {
	provide: WORKER_DATABASE,
	useFactory: createDb,
};

@Module({
	exports: [WORKER_DATABASE],
	providers: [workerDatabaseProvider],
})
export class WorkerDatabaseModule {}
