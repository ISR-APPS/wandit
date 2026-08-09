export class AmbiguousPaymentProviderWriteError extends Error {
	constructor(
		message: string,
		readonly cause: unknown,
	) {
		super(message, { cause });
		this.name = "AmbiguousPaymentProviderWriteError";
	}
}
