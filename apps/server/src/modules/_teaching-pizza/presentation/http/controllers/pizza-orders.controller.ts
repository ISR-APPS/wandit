// ============================================================================
// PRESENTATION = "the front door". A controller does exactly three things:
//   1. declare WHICH URLS exist
//   2. unpack the request (params, body, logged-in user)
//   3. call the brain, translate the answer (or the error) into HTTP
// NO business logic here. If a controller grows big, something is sitting
// in the wrong folder.
// ============================================================================

import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Inject,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import { TooManyToppingsError } from "../../../domain/errors/too-many-toppings.error";
import type { PizzaSize } from "../../../domain/pizza.types";
import { PizzaOrdersService } from "../../../application/services/pizza-orders.service";
// ^ value import (no `import type`!) — it goes into @Inject below.

// What the browser must POST to us. In the REAL controllers this shape lives
// in packages/contracts as a Zod schema (shared with the frontend!) and is
// checked at runtime by zod-validation.pipe. Kept as a plain type here so the
// lesson stays about NestJS.
interface PlaceOrderBody {
	size: PizzaSize;
	toppings: string[];
}

// ----------------------------------------------------------------------------
// @Controller("v1/pizza-orders") = "I own every URL starting with
// /api/v1/pizza-orders" (the global /api prefix is added in main.ts).
// Each method below adds its piece onto that base — same pattern as
// @Controller("v1/chats") in chats.controller.ts.
//
// Express translation:
//   const router = express.Router();          ← this class
//   router.post("/", handler)                 ← one method + decorator
//   app.use("/api/v1/pizza-orders", router)   ← the string in @Controller
// ----------------------------------------------------------------------------
@Controller("v1/pizza-orders")
export class PizzaOrdersController {
	// Same DI dance as in the service — the controller wishes for the brain,
	// NestJS delivers it. Controllers depend on services, never the reverse.
	constructor(
		@Inject(PizzaOrdersService)
		private readonly pizzaOrdersService: PizzaOrdersService,
	) {}

	// ==========================================================================
	// POST /api/v1/pizza-orders        ← the "drop off" endpoint
	// ==========================================================================
	// @Post() with no string = "no extra path, use the base URL directly".
	//
	// @Body() = "hand me the parsed JSON body of the request as `body`".
	// In Express you wrote app.use(express.json()) and read req.body — here
	// the decorator does the unpacking, and you receive it as a normal,
	// typed function argument.
	@Post()
	async placeOrder(@Body() body: PlaceOrderBody) {
		// The REAL controllers get the user from the session via the
		// @CurrentUser() decorator (backed by auth.guard.ts). This fake module
		// is not wired to auth, so we hardcode a user and tell you loudly.
		const userId = "user-teaching-demo";

		try {
			// One line of delegation. The controller does not know what a
			// price is or how orders are stored — and that is correct.
			const order = await this.pizzaOrdersService.placeOrder(
				userId,
				body.size,
				body.toppings,
			);
			// Whatever we return here is turned into JSON text and sent to
			// the browser (and wrapped inside { data: ... } by a global
			// helper — see infrastructure/http/api-response-envelope...).
			return order;
		} catch (error) {
			// THE TRANSLATION MOMENT. The brain threw a BUSINESS error
			// ("too many toppings"); only the front door knows HTTP, so HERE
			// is where it becomes a 400. BadRequestException is a ready-made
			// NestJS error that produces a clean {"statusCode":400,...} JSON.
			if (error instanceof TooManyToppingsError) {
				throw new BadRequestException(error.message);
			}
			// Anything unexpected: rethrow untouched → NestJS answers 500.
			// Never swallow unknown errors into fake "success".
			throw error;
		}
	}

	// ==========================================================================
	// GET /api/v1/pizza-orders/:orderId       ← the "read one" endpoint
	// ==========================================================================
	// The ":orderId" part of the URL is a placeholder — it matches whatever
	// value sits in that spot (/pizza-orders/abc → orderId is "abc").
	// @Param("orderId") takes that value and gives it to you as a normal
	// string argument. Express translation: req.params.orderId.
	@Get(":orderId")
	async getOrder(@Param("orderId") orderId: string) {
		const userId = "user-teaching-demo"; // real code: @CurrentUser()

		const order = await this.pizzaOrdersService.getOrder(userId, orderId);
		// The brain said null ("no such order — or not yours, none of your
		// business which"). The front door translates null into HTTP 404.
		if (!order) {
			throw new NotFoundException("Order not found");
		}
		return order;
	}
}
