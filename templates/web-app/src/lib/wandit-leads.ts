// Lead capture contract for the generated site.
// LeadForm calls submitLead(); the host preview listens for the event.
// No network request happens here. See docs/features/leads-crm.md.
import { z } from "zod";

/** Field names are the wandit lead contract. Do not rename them. */
export const leadFieldsSchema = z.object({
	name: z.string().trim().min(1),
	phone: z
		.string()
		.trim()
		.min(6)
		.regex(/^[+\d][\d\s().-]*$/, "digits and phone punctuation only"),
	wilaya: z.string().trim().min(1),
	commune: z.string().trim().min(1),
	product: z.string().trim().min(1),
	quantity: z.coerce.number().int().min(1),
	// Bots fill this hidden field; real users leave it empty or absent.
	website: z.literal("").optional(),
});

export type LeadFields = z.infer<typeof leadFieldsSchema>;

export type LeadSubmitResult = { ok: true } | { ok: false; error: "invalid" };

/**
 * Validates the fields and dispatches `wandit:lead` on the document.
 * The preview runtime owns the listener; without it the dispatch is a no-op.
 */
export function submitLead(
	input: Record<string, FormDataEntryValue>,
): LeadSubmitResult {
	const fields: Record<string, string> = {};
	for (const [key, value] of Object.entries(input)) {
		fields[key] = typeof value === "string" ? value : "";
	}

	// A filled honeypot means a bot. Report success and drop the lead.
	if (fields.website) {
		return { ok: true };
	}

	const parsed = leadFieldsSchema.safeParse(fields);
	if (!parsed.success) {
		return { ok: false, error: "invalid" };
	}

	document.dispatchEvent(
		new CustomEvent("wandit:lead", { detail: parsed.data }),
	);
	return { ok: true };
}
