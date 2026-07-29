import { z } from "zod";

export const mcpToolPolicySchema = z
	.object({
		allowlist: z.array(z.string()).optional(),
	})
	.strict();

export type McpToolApprovalMap = Record<
	string,
	"user-approval" | ((input: unknown) => "not-applicable" | "user-approval")
>;

export type McpToolPolicy = z.infer<typeof mcpToolPolicySchema>;
