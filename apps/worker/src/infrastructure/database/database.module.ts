// Worker database module.
//
// This tells Nest how the worker can get a database connection. The worker must
// use the same database as the API, because it reads chats saved by the API and
// writes assistant messages back to the same tables.
import { Module, type Provider } from "@nestjs/common";
import { createDb } from "@wandit/db";

import { WORKER_DATABASE, type WorkerDatabase } from "./database.constants";

// Provider means: when something asks for WORKER_DATABASE, call createDb().
const workerDatabaseProvider: Provider<WorkerDatabase> = {
	provide: WORKER_DATABASE,
	useFactory: createDb,
};

// Export the token so repositories can inject the DB connection.
@Module({
	exports: [WORKER_DATABASE],
	providers: [workerDatabaseProvider],
})
// Empty class: the @Module metadata above is the important part.
export class WorkerDatabaseModule {}
