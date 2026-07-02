import { Module, type Provider } from "@nestjs/common";
import { createDb } from "@wandit/db";

import { DATABASE, type Database } from "./database.constants";

const databaseProvider: Provider<Database> = {
	provide: DATABASE,
	useFactory: createDb,
};

@Module({
	exports: [DATABASE],
	providers: [databaseProvider],
})
export class DatabaseModule {}
