// ============================================================================
// THE MODULE = "the wiring". The last file to read — and suddenly the DI
// magic stops being magic.
// ============================================================================
// A NestJS app is a tree of modules (AppModule → AuthModule, GenerationModule,
// BillingModule, ...). Each module is a box that declares:
//   "here are my URLs, here are my LEGO bricks, here is what I share".
// ============================================================================

import { Module } from "@nestjs/common";
import { PizzaOrdersService } from "./application/services/pizza-orders.service";
import { PizzaPricingService } from "./application/services/pizza-pricing.service";
import { PizzaOrdersRepository } from "./infrastructure/persistence/pizza-orders.repository";
import { PizzaOrdersController } from "./presentation/http/controllers/pizza-orders.controller";

@Module({
	// CONTROLLERS: classes that own URLs. NestJS instantiates each one and
	// registers its routes. A class not listed here = its routes DO NOT EXIST,
	// even if the file is perfect.
	controllers: [PizzaOrdersController],

	// PROVIDERS: the LEGO box — every class that NestJS is allowed to build
	// and inject INSIDE this module. When PizzaOrdersService's constructor
	// wishes for @Inject(PizzaOrdersRepository), NestJS looks it up IN THIS
	// LIST. Not listed → "Nest can't resolve dependencies..." at startup —
	// read that error as: "someone wished for a brick that is not in the box".
	//
	// Order in the array does not matter; NestJS figures out build order from
	// the constructors (pricing before orders-service, etc.).
	providers: [PizzaOrdersService, PizzaPricingService, PizzaOrdersRepository],

	// IMPORTS: other MODULES whose exported bricks we want to use. The real
	// generation.module.ts imports the billing module this way to run the
	// credits check. Empty here — our fake feature needs nobody.
	imports: [],

	// EXPORTS: the small part of our providers that OTHER modules are allowed
	// to inject. Everything not listed here stays private to this module —
	// same idea as `private` on a class, but for a whole module. We share the
	// pricing brain (imagine a future "catering" module reusing it) and keep
	// the rest internal.
	exports: [PizzaPricingService],
})
export class PizzaModule {}

// ============================================================================
// WHY THIS MODULE NEVER RUNS
// ----------------------------------------------------------------------------
// app.module.ts does NOT list PizzaModule in its imports. So NestJS never
// opens this box: no routes registered, no classes built. To bring the pizza
// to life for real, one line in app.module.ts would do it:
//     imports: [ ...existing..., PizzaModule ]
// (Don't. It's a classroom, not a feature. 🍕)
// ============================================================================
