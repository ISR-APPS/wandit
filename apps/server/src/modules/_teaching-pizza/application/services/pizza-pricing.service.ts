// ============================================================================
// APPLICATION = "the brain". This is the SIMPLEST possible service:
// no constructor, no dependencies, just one calculation.
// Its real-repo cousin is generation-policy.service.ts (the credits check) —
// also a small brain that answers one question.
// ============================================================================

import { Injectable } from "@nestjs/common";
import type { PizzaSize } from "../../domain/pizza.types";

// Why is pricing its OWN service instead of a function inside the main one?
// 1. One job per class → you always know where price logic lives.
// 2. It can be tested alone: new PizzaPricingService() in a test, done.
// 3. Another module could inject just the pricing without the rest.
@Injectable()
export class PizzaPricingService {
	// Prices in cents (integers — see the money comment in pizza.types.ts).
	// `satisfies` = TypeScript-only check that every PizzaSize has a price;
	// if someone adds "xl" to PizzaSize, this line turns red. Zero runtime cost.
	private readonly basePriceCents = {
		small: 800,
		medium: 1100,
		large: 1400,
	} satisfies Record<PizzaSize, number>;

	private readonly perToppingCents = 150;

	// The one job: size + topping count → price.
	// Pure calculation: same inputs always give the same output, touches
	// nothing outside. The easiest kind of code to trust and to test.
	priceFor(size: PizzaSize, toppingCount: number): number {
		return this.basePriceCents[size] + toppingCount * this.perToppingCents;
	}
}
