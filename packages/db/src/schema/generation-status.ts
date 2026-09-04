import { pgEnum } from "drizzle-orm/pg-core";

export const generationStatus = pgEnum("media_generation_status", [
	"queued",
	"generating",
	"succeeded",
	"failed",
]);
