import type { createDb } from "@wandit/db";

export const WORKER_DATABASE = Symbol("WORKER_DATABASE");

export type WorkerDatabase = ReturnType<typeof createDb>;
