import { apiClient } from "@/shared/lib/api-client";
import { EXAMPLE_BASE_PATH } from "@/features/example/lib/example.constants";
import {
	type CreateExampleInput,
	type Example,
	exampleListSchema,
	exampleSchema,
} from "@/features/example/lib/example.schemas";

/**
 * example.requests.ts — the ACTUAL calls to the backend.
 *
 * This is the phone's "service" file — but we name it *.requests so it never gets
 * confused with a NestJS backend *.service (which holds real business logic + DB
 * access). Here there is no logic: each function sends one HTTP request through
 * the shared apiClient and returns validated data. No React, no caching.
 *
 * Notice every function validates the server's response with a Zod schema before
 * returning it — so the rest of the app can fully trust the data's shape.
 */

// GET /api/v1/examples
export async function getExamples(): Promise<Example[]> {
	const data = await apiClient.get<Example[]>(EXAMPLE_BASE_PATH);
	return exampleListSchema.parse(data);
}

// GET /api/v1/examples/:id
export async function getExample(id: string): Promise<Example> {
	const data = await apiClient.get<Example>(`${EXAMPLE_BASE_PATH}/${id}`);
	return exampleSchema.parse(data);
}

// POST /api/v1/examples
export async function createExample(
	input: CreateExampleInput,
): Promise<Example> {
	const data = await apiClient.post<Example, CreateExampleInput>(
		EXAMPLE_BASE_PATH,
		input,
	);
	return exampleSchema.parse(data);
}

// DELETE /api/v1/examples/:id
export async function deleteExample(id: string): Promise<void> {
	await apiClient.delete(`${EXAMPLE_BASE_PATH}/${id}`);
}
