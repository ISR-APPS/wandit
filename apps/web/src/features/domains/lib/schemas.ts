// UI-side form schemas. Server contracts remain the source of truth; these
// schemas only shape client form state before calling the contract parsers.

import {
	attachExternalDomainBodySchema,
	purchaseDomainBodySchema,
	registrantSchema,
	searchDomainsQuerySchema,
} from "@wandit/contracts";
import { z } from "zod";

export const domainSearchFormSchema = searchDomainsQuerySchema;
export const registrantFormSchema = registrantSchema;
export const purchaseDomainFormSchema = purchaseDomainBodySchema;
export const externalDomainFormSchema = attachExternalDomainBodySchema;

export const registrantFlatFormSchema = z.object({
	firstName: z.string().trim().min(1),
	lastName: z.string().trim().min(1),
	email: z.email(),
	// Keep this identical to the Name.com-compatible server validation.
	phone: z
		.string()
		.trim()
		.regex(/^\+[1-9]\d{7,14}$/),
	companyName: z.string().trim().optional(),
	street: z.string().trim().min(1),
	city: z.string().trim().min(1),
	wilaya: z.string().trim().min(1),
	zip: z.string().trim().min(1),
	countryCode: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{2}$/),
});

export type RegistrantFlatFormValues = z.infer<typeof registrantFlatFormSchema>;
