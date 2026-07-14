// Database token and type for the worker.
//
// Nest can inject classes by class name. For plain values, like a database
// connection, we give Nest a token. This token is the name Nest uses to find the
// worker database connection.
import type { createDb } from "@wandit/db";

// Runtime token for the worker's database connection.
export const WORKER_DATABASE = Symbol("WORKER_DATABASE");

// TypeScript type for the Drizzle database connection. Types disappear at runtime.
export type WorkerDatabase = ReturnType<typeof createDb>;
