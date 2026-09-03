import { HttpException } from "@nestjs/common";

import { toClientAiError } from "./classify-ai-error";
import type { NormalizedAiError } from "./normalized-ai-error";

const statusForKind = (normalized: NormalizedAiError): number => {
	switch (normalized.kind) {
		case "rate_limited":
		case "capacity":
			return 503;
		case "timeout":
			return 504;
		case "content_moderated":
			return 422;
		case "invalid_request":
			return 400;
		default:
			return 500;
	}
};

export class AiErrorHttpException extends HttpException {
	constructor(readonly normalized: NormalizedAiError) {
		super(
			{
				code: `AI_${normalized.kind.toUpperCase()}`,
				details: toClientAiError(normalized),
			},
			statusForKind(normalized),
		);
		this.name = "AiErrorHttpException";
	}
}
