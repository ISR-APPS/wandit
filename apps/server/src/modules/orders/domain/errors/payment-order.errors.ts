import { HttpException, HttpStatus } from "@nestjs/common";

export class OrderNotFoundError extends HttpException {
	constructor() {
		super(
			{
				code: "ORDER_NOT_FOUND",
				message: "Payment order not found",
			},
			HttpStatus.NOT_FOUND,
		);
	}
}

export class OrderInvariantViolationError extends HttpException {
	constructor(message = "Payment order does not match its checkout session") {
		super(
			{
				code: "ORDER_INVARIANT_VIOLATION",
				message,
			},
			HttpStatus.CONFLICT,
		);
	}
}
