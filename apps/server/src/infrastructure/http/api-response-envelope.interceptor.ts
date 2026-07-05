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

@Injectable()
export class ApiResponseEnvelopeInterceptor implements NestInterceptor {
	constructor(
		@Inject(Reflector)
		private readonly reflector: Reflector,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
			SKIP_RESPONSE_ENVELOPE_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (skipEnvelope) {
			return next.handle();
		}

		const http = context.switchToHttp();
		const request = http.getRequest<FastifyRequest>();
		const reply = http.getResponse<FastifyReply>();

		return next.handle().pipe(
			map((value: unknown) => {
				if (reply.sent) {
					return value;
				}

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
