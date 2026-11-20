/**
 * Records the "upgrade clicked" product event of each checkout, then continues the checkout.
 * The card tab of the top-up dialog, the SlickPay panel, and the offline panel call it.
 */
import type { ProductEventSurface } from "@wandit/contracts";

import {
	emitUpgradeClicked,
	type ProductEventEmitter,
} from "@/features/product-events";

type UpgradeClickedEmitter = ProductEventEmitter["upgradeClicked"];
type CheckoutNavigator = (url: string) => void;

export async function completeCardCheckoutStart(
	url: string,
	surface: ProductEventSurface,
	emit: UpgradeClickedEmitter = emitUpgradeClicked,
	navigate: CheckoutNavigator = (target) => window.location.assign(target),
): Promise<void> {
	await emit({ method: "card", surface }, "authenticated");
	navigate(url);
}

/** Same order as the card flow: the event is sent before the browser leaves for the SlickPay page. */
export async function completeSlickpayCheckoutStart(
	url: string,
	surface: ProductEventSurface,
): Promise<void> {
	await emitUpgradeClicked({ method: "slickpay", surface }, "authenticated");
	window.location.assign(url);
}

export function recordOfflineCheckoutStart(
	surface: ProductEventSurface,
	emit: UpgradeClickedEmitter = emitUpgradeClicked,
): Promise<void> {
	return emit({ method: "offline", surface }, "authenticated");
}
