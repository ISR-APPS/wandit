import type { createDb } from "@my-better-t-app/db";

export const DATABASE = Symbol("DATABASE");

export type Database = ReturnType<typeof createDb>;
