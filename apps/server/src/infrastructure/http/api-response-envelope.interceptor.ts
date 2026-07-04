import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { map, type Observable } from "rxjs";

@Injectable()
export class ApiResponseEnvelopeInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
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
