import { z } from "zod";

export const generationStatusSchema = z.enum([
	"queued",
	"generating",
	"succeeded",
	"failed",
]);

export type GenerationStatus = z.infer<typeof generationStatusSchema>;
