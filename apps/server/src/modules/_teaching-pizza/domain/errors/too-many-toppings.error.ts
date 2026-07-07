// ============================================================================
// DOMAIN ERROR = "a business rule was broken", said as a throwable object
// ============================================================================
// Compare with the real ones: generation-payment-required.error.ts says
// "no credits", generation-active.error.ts says "already generating".
// This one says "too many toppings". All three are BUSINESS facts.
//
// Why make a whole class instead of throw new Error("too many toppings")?
// Because the front door (controller) can then do:
//
//     if (err instanceof TooManyToppingsError) → answer HTTP 400
//
// The TYPE of the error carries the meaning. With a plain Error you would
// have to compare message strings, which breaks the day someone rewords one.
// ============================================================================

import { MAX_TOPPINGS } from "../pizza.types";
// ^ Notice: a domain file may import OTHER domain files. That is allowed.
//   What it may never import: NestJS, Drizzle, Redis, anything technical.

export class TooManyToppingsError extends Error {
	// A stable machine-readable code. The frontend can switch on this safely,
	// even if we reword the human message below. Same trick as the real
	// errors (they carry codes like "generation_payment_required").
	readonly code = "too_many_toppings";

	constructor(requested: number) {
		// super(...) calls the constructor of the parent class (Error) and
		// sets the human-readable .message property.
		super(
			`A pizza can have at most ${MAX_TOPPINGS} toppings, you asked for ${requested}.`,
		);
		// Cosmetic: makes stack traces print "TooManyToppingsError" instead
		// of "Error". The real error classes in this repo do the same.
		this.name = "TooManyToppingsError";
	}
}
