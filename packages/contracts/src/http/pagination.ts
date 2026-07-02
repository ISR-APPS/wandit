import { z } from "zod";

// Shared pagination for list endpoints, carried inside the `{ data, meta }`
// envelope. Query params arrive as strings — coerce before validating.

export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

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
