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

export function recordOfflineCheckoutStart(
	surface: ProductEventSurface,
	emit: UpgradeClickedEmitter = emitUpgradeClicked,
): Promise<void> {
	return emit({ method: "offline", surface }, "authenticated");
}
