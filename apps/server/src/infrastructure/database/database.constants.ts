import type { createDb } from "@wandit/db";

export const DATABASE = Symbol("DATABASE");

export type Database = ReturnType<typeof createDb>;
