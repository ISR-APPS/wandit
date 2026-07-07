/**
 * Validates request data with a Zod schema.
 *
 * In Express you might write `schema.parse(req.body)` inside the route.
 * In Nest, a "pipe" can run before the controller method and validate params,
 * query values, or the body.
 */
import {
	type ArgumentMetadata,
	BadRequestException,
	type PipeTransform,
} from "@nestjs/common";

// One validation error. `path` is the field name, `message` explains the error.
export type ZodValidationIssue = {
	readonly message: string;
	readonly path: readonly PropertyKey[];
};

// The small part of Zod's `safeParse` result that this file needs.
type SafeParseResult<TOutput> =
	| {
			data: TOutput;
			success: true;
	  }
	| {
			error: {
				issues: readonly ZodValidationIssue[];
			};
			success: false;
	  };

// Any object with `safeParse` can be used here. Usually that object is a Zod
// schema from `@wandit/contracts`.
type ZodSchemaLike<TOutput> = {
	safeParse(value: unknown): SafeParseResult<TOutput>;
};

// A pipe runs before the controller. It either returns valid parsed data or
// throws an HTTP 400 error.
export class ZodValidationPipe<TOutput>
	implements PipeTransform<unknown, TOutput>
{
	constructor(private readonly schema: ZodSchemaLike<TOutput>) {}

	// Nest gives this method the raw value from the request.
	transform(value: unknown, metadata: ArgumentMetadata): TOutput {
		// `safeParse` does not throw. It returns `{ success: false }` if invalid.
		const result = this.schema.safeParse(value);

		if (!result.success) {
			// `BadRequestException` becomes HTTP 400.
			throw new BadRequestException({
				issues: this.withMetadataPath(result.error.issues, metadata.data),
				message: "Validation failed",
			});
		}

		// The controller receives the clean parsed value, not the raw input.
		return result.data;
	}

	// If Zod gives no field path, use the Nest parameter name, like `chatId`.
	private withMetadataPath(
		issues: readonly ZodValidationIssue[],
		metadataPath?: string,
	): ZodValidationIssue[] {
		return issues.map((issue) => ({
			...issue,
			path:
				issue.path.length === 0 && metadataPath
					? [metadataPath]
					: [...issue.path],
		}));
	}
}
