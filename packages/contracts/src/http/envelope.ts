import { z } from "zod";

// The JSON envelope shared by every HTTP caller. Transport contracts only —
// not Nest DTOs and not UI models. The server's response interceptor wraps
// success payloads and its exception filter emits the error shape; the web
// api client (apps/web/src/lib/BaseService.ts) unwraps and normalizes both.

export const apiResponseMetaSchema = z.object({
	requestId: z.string(),
	timestamp: z.string(),
});

export type ApiResponseMeta = z.infer<typeof apiResponseMetaSchema>;

export type ApiSuccessResponse<TData> = {
	data: TData;
	meta: ApiResponseMeta;
};

// Schema factory for callers that parse a whole envelope (the api client
// usually strips it first, so feature layers parse the `data` payload only).
export function apiSuccessResponseSchema<TData extends z.ZodType>(
	dataSchema: TData,
) {
	return z.object({
		data: dataSchema,
		meta: apiResponseMetaSchema,
	});
}

export const apiErrorResponseSchema = z.object({
	error: z.object({
		code: z.string(),
		details: z.unknown().optional(),
		message: z.string(),
		path: z.string(),
		requestId: z.string(),
		statusCode: z.number(),
		timestamp: z.string(),
	}),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
