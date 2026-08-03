import { z } from "zod";

// Shared pagination for list endpoints, carried inside the `{ data, meta }`
// envelope. Query params arrive as strings — coerce before validating.

export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// Keyset pagination for feeds whose contents can change while the user moves
// through them. The cursor is deliberately opaque to API consumers; each
// endpoint owns its encoding and validates the decoded payload server-side.
export const cursorPaginationQuerySchema = z.object({
	cursor: z.string().trim().min(1).max(1_000).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export type PaginatedResult<TItem> = {
	items: TItem[];
	page: number;
	pageSize: number;
	total: number;
};

export function paginatedResultSchema<TItem extends z.ZodType>(
	itemSchema: TItem,
) {
	return z.object({
		items: z.array(itemSchema),
		page: z.number().int(),
		pageSize: z.number().int(),
		total: z.number().int(),
	});
}
