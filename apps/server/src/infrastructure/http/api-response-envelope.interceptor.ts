/**
 * Wraps normal API responses in `{ data, meta }`.
 *
 * In Express you might do this by always calling `res.json({ data, meta })`.
 * In Nest, an interceptor can do it for every controller automatically.
 *
 * The chat stream route is special. SSE must send raw `event:` and `data:`
 * text, so that route uses `@SkipResponseEnvelope()`.
 */
import {
	type CallHandler,
	type ExecutionContext,
	Inject,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";
import { map, type Observable } from "rxjs";

import { SKIP_RESPONSE_ENVELOPE_KEY } from "./skip-envelope.decorator";

// An interceptor runs around a controller method. It can change the value before
// it is sent to the browser. `@Injectable()` means Nest is allowed to create it.
@Injectable()
export class ApiResponseEnvelopeInterceptor implements NestInterceptor {
	constructor(
		// Reflector reads small flags added by decorators, for example
		// `@SkipResponseEnvelope()`.
		@Inject(Reflector)
		private readonly reflector: Reflector,
	) {}

	// Nest calls this for each request. `next.handle()` means "run the controller
	// method and give me the result".
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		// Check if this route asked to skip the wrapper.
		const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
			SKIP_RESPONSE_ENVELOPE_KEY,
			[context.getHandler(), context.getClass()],
		);

		// Streams and other custom responses must stay raw.
		if (skipEnvelope) {
			return next.handle();
		}

		// Get the normal HTTP request/reply objects from Nest's generic context.
		const http = context.switchToHttp();
		const request = http.getRequest<FastifyRequest>();
		const reply = http.getResponse<FastifyReply>();

		// Nest uses RxJS here. `map` changes the successful controller result.
		return next.handle().pipe(
			map((value: unknown) => {
				// If the route already sent bytes itself, do not touch it.
				if (reply.sent) {
					return value;
				}

				// Normal JSON response shape used by the frontend API client.
				return {
					data: value,
					meta: {
						requestId: request.id,
						timestamp: new Date().toISOString(),
					},
				};
			}),
		);
	}
}
