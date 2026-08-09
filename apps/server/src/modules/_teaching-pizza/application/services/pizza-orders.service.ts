// ============================================================================
// THE MAIN BRAIN — and THE DEPENDENCY INJECTION LESSON. Read slowly.
// ============================================================================
// This service tells the "place an order" story step by step, exactly like
// chat.service.ts tells the "send a message" story (check → save → enqueue).
// ============================================================================

import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { TooManyToppingsError } from "../../domain/errors/too-many-toppings.error";
import {
	MAX_TOPPINGS,
	type PizzaOrder,
	type PizzaSize,
} from "../../domain/pizza.types";
import { PizzaOrdersRepository } from "../../infrastructure/persistence/pizza-orders.repository";
import { PizzaPricingService } from "./pizza-pricing.service";
// ^ CAREFUL — a trap that already caused bugs in this repo.
//
//   TypeScript gives you two ways to import something:
//
//     import { X } from "..."        → brings the REAL thing.
//                                      It still exists when the program runs.
//     import type { X } from "..."   → brings only the "shape", for your
//                                      editor. It is DELETED when the
//                                      program runs.
//
//   Lower in this file we write @Inject(PizzaOrdersRepository). That line
//   needs the REAL class while the program runs. So if you import that class
//   with `import type`, here is what happens: the import is deleted →
//   @Inject(...) receives nothing → NestJS quietly gives the service an
//   empty dependency → the server starts fine, and crashes later, the first
//   time someone calls it. Very hard to debug.
//
//   Simple rule: a class you put inside @Inject(...) → normal import.
//   `import type` only for pure shapes, like PizzaOrder above.

@Injectable()
export class PizzaOrdersService {
	// ==========================================================================
	// DEPENDENCY INJECTION (DI), in plain words.
	//
	// Nobody in this codebase EVER writes:
	//     const repo = new PizzaOrdersRepository();       // ❌ never
	//
	// Instead, the class publishes a wish list — its constructor parameters:
	//     "to do my job I need a PizzaOrdersRepository and a PizzaPricingService"
	//
	// At startup NestJS reads the module wiring (pizza.module.ts), builds one
	// instance of each provider, and delivers them here. Like a restaurant:
	// you don't cook your own ingredients, you declare what you need and the
	// kitchen brings it.
	//
	// WHY? Two big wins:
	// 1. NestJS builds ONE copy of each class and everyone shares that same
	//    copy (the fancy word for this is "singleton"). So the controller and
	//    this service talk to the SAME repository — one database connection,
	//    not ten.
	// 2. In tests you can hand in fake ingredients:
	//    new PizzaOrdersService(fakeRepo, fakePricing) — and test the logic
	//    with no database at all.
	//
	// ANATOMY of one line, piece by piece:
	//   @Inject(PizzaOrdersRepository)  ← "the thing I want is registered
	//                                      under this name" (the class itself
	//                                      is used as the lookup key)
	//   private                         ← auto-creates this.ordersRepository;
	//                                      only this class can use it
	//   readonly                        ← cannot be reassigned later
	//   ordersRepository:               ← the property name YOU choose
	//   PizzaOrdersRepository           ← the TypeScript type, for your editor
	//
	// NOTE: in most NestJS tutorials online you will NOT see @Inject(...) —
	// they just write `constructor(private repo: PizzaOrdersRepository)` and
	// it works. Why does it work for them and not for us? Their build tool
	// leaves small hints in the final JavaScript ("this parameter was a
	// PizzaOrdersRepository"), and NestJS reads those hints. The tool WE use
	// to run the server (called tsx) does not leave those hints. No hints →
	// NestJS cannot guess → we must say it ourselves with @Inject(...).
	// Forget it and the dependency arrives empty — no error at startup,
	// crash at the first call.
	// ==========================================================================
	constructor(
		@Inject(PizzaOrdersRepository)
		private readonly ordersRepository: PizzaOrdersRepository,
		@Inject(PizzaPricingService)
		private readonly pricingService: PizzaPricingService,
	) {}

	// ==========================================================================
	// THE STORY: place an order. Compare with chat.service.ts sendMessage():
	//   check the rules → compute → save → hand off. Same skeleton.
	// ==========================================================================
	async placeOrder(
		userId: string,
		size: PizzaSize,
		toppings: string[],
	): Promise<PizzaOrder> {
		// STEP 1 — enforce business rules BEFORE touching storage.
		// (chat.service.ts does the same: credits check BEFORE saving anything,
		// so a rejected request leaves zero traces.)
		if (toppings.length > MAX_TOPPINGS) {
			// We throw a DOMAIN error. Note what we do NOT do here: we do NOT
			// answer HTTP 400 — the brain doesn't know HTTP exists. Translating
			// business errors into status codes is the front door's job.
			throw new TooManyToppingsError(toppings.length);
		}

		// STEP 2 — delegate the price question to the specialist.
		const priceCents = this.pricingService.priceFor(size, toppings.length);

		// STEP 3 — build the business object. The service decides the id and
		// the starting status — storage should store, not invent facts.
		const order: PizzaOrder = {
			id: randomUUID(),
			userId,
			size,
			toppings,
			priceCents,
			status: "received",
			createdAt: new Date(),
		};

		// STEP 4 — hand it to storage. HOW it is stored (Map? Postgres?) is
		// not our business up here.
		await this.ordersRepository.insert(order);

		// In the REAL app, a step 5 would live here: enqueue a BullMQ job so a
		// worker "bakes" the pizza in the background, and publish progress on
		// a Redis channel "pizza:<id>" — the exact chat-generation pattern you
		// already know. Skipped here to keep the lesson small.

		return order;
	}

	// The read side, with the ownership check you saw in the chat flow:
	// asking for an order that is not yours behaves exactly like an order
	// that does not exist (null). We never confirm other people's data exists.
	async getOrder(userId: string, orderId: string): Promise<PizzaOrder | null> {
		const order = await this.ordersRepository.findById(orderId);
		if (!order || order.userId !== userId) {
			return null;
		}
		return order;
	}
}
