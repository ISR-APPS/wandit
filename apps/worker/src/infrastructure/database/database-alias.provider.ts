import type { Provider } from "@nestjs/common";

import { DATABASE } from "../../../../server/src/infrastructure/database/database.constants";
import { WORKER_DATABASE } from "./database.constants";

// Reused server services share the worker's pool instead of opening a second one.
export const databaseProvider: Provider = {
	provide: DATABASE,
	useExisting: WORKER_DATABASE,
};
