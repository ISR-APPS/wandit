// ============================================================================
// DOMAIN = "the business words"
// ============================================================================
// This file is pure TypeScript. Look at the imports section: THERE IS NONE.
// No NestJS, no database, no Redis. That is the whole point of domain/.
// If tomorrow we throw away NestJS and rewrite the app in Express, this file
// survives without changing a single letter — because "what a pizza order IS"
// has nothing to do with which framework serves it.
// ============================================================================

// A "union type": the size can ONLY be one of these three exact strings.
// TypeScript will refuse "extra-large" at compile time. Free validation.
export type PizzaSize = "small" | "medium" | "large";

// The states an order moves through. Same idea as a chat generation:
// it starts "received", some work happens, it ends "delivered".
export type PizzaOrderStatus = "received" | "baking" | "delivered";

// The main business object of this feature.
// Notice it is an `interface` (a shape), not a `class` (a machine).
// Domain objects here are plain data — no methods, no behavior, just facts.
export interface PizzaOrder {
	id: string;
	// Who ordered. Every real feature in this repo carries a userId so we can
	// always answer "is this yours?" (remember the ownership checks in chats).
	userId: string;
	size: PizzaSize;
	toppings: string[];
	// Price in cents. Money as integers, never floats — floats lose pennies
	// (0.1 + 0.2 === 0.30000000000000004 in JavaScript. Really.).
	priceCents: number;
	status: PizzaOrderStatus;
	createdAt: Date;
}

// A business rule expressed as a constant. Rules-as-data live happily in
// domain/ because they are facts about the business, not about technology.
export const MAX_TOPPINGS = 5;
