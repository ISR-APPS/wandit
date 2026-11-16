// The kinds of audience segment that the team targets.
// The sample tables, the audience list tabs, and the audience panel read this list.

/** Every audience type. The label is the message key `audienceTypes.<type>`. */
export const AUDIENCE_TYPES = [
	"customer_list",
	"lookalike",
	"interest",
	"retargeting",
] as const;

/** One audience type. */
export type AudienceType = (typeof AUDIENCE_TYPES)[number];
