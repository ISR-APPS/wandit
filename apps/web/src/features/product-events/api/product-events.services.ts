import {
	type CreateProductEventRequest,
	createProductEventRequestSchema,
	PRODUCT_EVENTS_ROUTES,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";

const PRODUCT_EVENTS_CREATE_PATH = `/api${PRODUCT_EVENTS_ROUTES.create}`;

export async function createProductEvent(
	request: CreateProductEventRequest,
): Promise<void> {
	const body = createProductEventRequestSchema.parse(request);

	await ApiService.post<unknown, CreateProductEventRequest>(
		PRODUCT_EVENTS_CREATE_PATH,
		body,
		{ skipAuthRedirect: true },
	);
}
