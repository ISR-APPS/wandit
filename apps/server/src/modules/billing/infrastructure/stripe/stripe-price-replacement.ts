import type Stripe from "stripe";

const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
	"canceled",
	"incomplete_expired",
]);

type StripePriceReplacementClient = Pick<Stripe, "prices" | "subscriptions">;

export async function replaceStripePriceSafely(
	stripe: StripePriceReplacementClient,
	existingPrice: Pick<Stripe.Price, "id" | "recurring">,
	createParams: Stripe.PriceCreateParams,
	idempotencyKey: string,
): Promise<Stripe.Price> {
	const existingSubscription = existingPrice.recurring
		? await findNonTerminalSubscription(stripe, existingPrice.id)
		: null;

	if (existingSubscription) {
		throw replacementBlockedError(existingPrice.id, existingSubscription);
	}

	await stripe.prices.update(existingPrice.id, { active: false });

	try {
		// Closing the price prevents a new subscription from entering after this
		// second check. Existing checkout sessions are also caught before transfer.
		const racedSubscription = existingPrice.recurring
			? await findNonTerminalSubscription(stripe, existingPrice.id)
			: null;

		if (racedSubscription) {
			throw replacementBlockedError(existingPrice.id, racedSubscription);
		}
	} catch (error) {
		await reactivateAfterGuardFailure(stripe, existingPrice.id, error);
	}

	return stripe.prices.create(
		{
			...createParams,
			transfer_lookup_key: true,
		},
		{ idempotencyKey },
	);
}

async function findNonTerminalSubscription(
	stripe: StripePriceReplacementClient,
	priceId: string,
): Promise<Stripe.Subscription | null> {
	let startingAfter: string | undefined;

	for (;;) {
		const page = await stripe.subscriptions.list({
			limit: 100,
			price: priceId,
			status: "all",
			...(startingAfter ? { starting_after: startingAfter } : {}),
		});
		const subscription = page.data.find(
			(item) => !TERMINAL_SUBSCRIPTION_STATUSES.has(item.status),
		);

		if (subscription) {
			return subscription;
		}

		if (!page.has_more) {
			return null;
		}

		startingAfter = page.data.at(-1)?.id;
		if (!startingAfter) {
			throw new Error(
				`Stripe returned an empty paginated subscription page for price ${priceId}`,
			);
		}
	}
}

async function reactivateAfterGuardFailure(
	stripe: StripePriceReplacementClient,
	priceId: string,
	cause: unknown,
): Promise<never> {
	try {
		await stripe.prices.update(priceId, { active: true });
	} catch (reactivationError) {
		throw new AggregateError(
			[cause, reactivationError],
			`Stripe price ${priceId} replacement guard failed and the old price could not be reactivated`,
		);
	}

	throw cause;
}

function replacementBlockedError(
	priceId: string,
	subscription: Pick<Stripe.Subscription, "id" | "status">,
): Error {
	return new Error(
		`Refusing to replace Stripe price ${priceId}: subscription ${subscription.id} has non-terminal status ${subscription.status}`,
	);
}
