import {
	type ArgumentMetadata,
	BadRequestException,
	type PipeTransform,
} from "@nestjs/common";

export type ZodValidationIssue = {
	readonly message: string;
	readonly path: readonly PropertyKey[];
};

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

type ZodSchemaLike<TOutput> = {
	safeParse(value: unknown): SafeParseResult<TOutput>;
};

export class ZodValidationPipe<TOutput>
	implements PipeTransform<unknown, TOutput>
{
	constructor(private readonly schema: ZodSchemaLike<TOutput>) {}

	transform(value: unknown, metadata: ArgumentMetadata): TOutput {
		const result = this.schema.safeParse(value);

		if (!result.success) {
			throw new BadRequestException({
				issues: this.withMetadataPath(result.error.issues, metadata.data),
				message: "Validation failed",
			});
		}

		return result.data;
	}

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
