// ============================================================================
// INFRASTRUCTURE = "the hands" — the only layer allowed to touch real tools
// ============================================================================
// A "repository" is a class whose only job is: store and fetch one kind of
// thing. Nothing else. No business decisions. If you ever see an `if` about
// prices or permissions inside a repository — it is in the wrong layer.
//
// The real chats.repository.ts talks to Postgres through Drizzle.
// To keep this lesson dependency-free, our "database" is a Map in memory.
// The IMPORTANT part is identical: the brain (service) calls friendly methods
// like insert() / findById() and has NO idea what storage sits behind them.
// Swap this Map for Drizzle tomorrow → the service does not change AT ALL.
// That is the whole reason repositories exist.
// ============================================================================

import { Injectable } from "@nestjs/common";
import type { PizzaOrder, PizzaOrderStatus } from "../../domain/pizza.types";

// ----------------------------------------------------------------------------
// @Injectable() — your first NestJS decorator. Plain English:
//
//   "Dear NestJS, this class is a LEGO brick. You are allowed to build it
//    and hand it to any other class that asks for it in its constructor."
//
// Without this decorator, NestJS refuses to construct the class for you.
// Every service and repository in this repo starts with it.
// ----------------------------------------------------------------------------
@Injectable()
export class PizzaOrdersRepository {
	// Our fake database table. private = only this class can touch it,
	// which is exactly the rule we want: ALL storage access goes through
	// the methods below. (A real repo holds a Drizzle connection here.)
	private readonly rows = new Map<string, PizzaOrder>();

	// The methods are async and return Promises even though a Map is instant.
	// On purpose! A real database IS slow/async, and the service layer should
	// not need rewriting the day we swap this Map for Postgres.
	async insert(order: PizzaOrder): Promise<void> {
		this.rows.set(order.id, order);
	}

	// Returns the order, or null when it does not exist.
	// Repositories return null and let the BRAIN decide if that is an error —
	// "not found" is a business decision, not a storage decision.
	async findById(id: string): Promise<PizzaOrder | null> {
		return this.rows.get(id) ?? null;
	}

	// Every read is filtered by userId — same habit as the real repos
	// (remember: chats are always fetched through "does this user own it").
	async findAllForUser(userId: string): Promise<PizzaOrder[]> {
		return [...this.rows.values()].filter((row) => row.userId === userId);
	}

	async updateStatus(id: string, status: PizzaOrderStatus): Promise<void> {
		const row = this.rows.get(id);
		if (row) {
			this.rows.set(id, { ...row, status });
		}
	}
}
