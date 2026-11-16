import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";

import { ApiResponseEnvelopeInterceptor } from "./api-response-envelope.interceptor";

class RouteController {
	route(): void {}
}

describe("ApiResponseEnvelopeInterceptor", () => {
	it("does not wrap a 304, so Fastify sends no body headers", async () => {
		const request = { id: "req_304" };
		const reply = { sent: false, statusCode: 304 };
		const context = new ExecutionContextHost(
			[request, reply],
			RouteController,
			RouteController.prototype.route,
		);

		const value = await firstValueFrom(
			new ApiResponseEnvelopeInterceptor(new Reflector()).intercept(context, {
				handle: () => of(undefined),
			}),
		);

		expect(value).toBeUndefined();
	});
});
