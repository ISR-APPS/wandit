// Reads of the header alerts: the pending transactions, the recent failed ones, and the large price moves of held assets.
// HeaderNotifications reads it after the shell renders. A pending alert is also a row of the "Pending" tab of Activity.
// The queryFn reads the sample ledger. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { formatQuantity } from "../lib/format";
import { buildPositionStates } from "../lib/positions";
import { getSampleLedger, priceDaysAgo } from "../lib/sample-data";
import { DAY_MS } from "../lib/time";

/** A held asset that moved this much in 24 hours, up or down, gets an alert. 0.05 is 5 %. */
export const LARGE_MOVE_RATIO = 0.05;
// A failed transaction stays in the bell for this many days. Older failures stay in the Activity log only.
const FAILED_ALERT_DAYS = 30;

// linkOptions types each path, so a wrong path fails typecheck.
function transactionLink(transactionId: string) {
	return linkOptions({ to: "/app/activity", search: { tx: transactionId } });
}
function assetLink(assetId: string) {
	return linkOptions({ to: "/app/markets/$assetId", params: { assetId } });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "pending": waits for confirmation. "failed": failed in the last 30 days. "largeMove": a held asset moved 5 % or more in 24 hours. */
	kind: "pending" | "failed" | "largeMove";
	/** The asset name. */
	title: string;
	/** The transaction line ("0.85 HLN") or the signed 24-hour change ("-6.2%"). */
	detail: string;
	/** ISO time: the time of the transaction, or the start of today for a price move. */
	at: string;
	link: ReturnType<typeof transactionLink> | ReturnType<typeof assetLink>;
};

/** Every alert, the newest first. The bell shows the count and the first 5. `locale` formats the detail line. */
export function alertsQueryOptions(locale: string) {
	return queryOptions({
		queryKey: ["alerts", locale],
		queryFn: async (): Promise<Alert[]> => {
			const ledger = getSampleLedger();
			const assets = new Map(ledger.assets.map((asset) => [asset.id, asset]));
			const failedFrom = ledger.anchor - FAILED_ALERT_DAYS * DAY_MS;
			const transactionAlerts = ledger.transactions.flatMap((row): Alert[] => {
				const asset = assets.get(row.assetId);
				const isAlert =
					row.status === "pending" ||
					(row.status === "failed" && Date.parse(row.occurredAt) >= failedFrom);
				if (!asset || !isAlert || row.status === "confirmed") {
					return [];
				}
				return [
					{
						id: row.id,
						kind: row.status,
						title: asset.name,
						detail: `${formatQuantity(row.quantity, locale)} ${asset.symbol}`,
						at: row.occurredAt,
						link: transactionLink(row.id),
					},
				];
			});
			const percent = new Intl.NumberFormat(locale, {
				style: "percent",
				signDisplay: "exceptZero",
				maximumFractionDigits: 1,
			});
			const states = buildPositionStates(ledger.transactions, ledger.anchor);
			const moveAlerts = ledger.assets.flatMap((asset): Alert[] => {
				const price = priceDaysAgo(ledger, asset.id, 0);
				const yesterday = priceDaysAgo(ledger, asset.id, 1);
				const change = yesterday === 0 ? 0 : (price - yesterday) / yesterday;
				const isHeld = (states.get(asset.id)?.quantity ?? 0) > 0;
				if (!isHeld || Math.abs(change) < LARGE_MOVE_RATIO) {
					return [];
				}
				return [
					{
						id: asset.id,
						kind: "largeMove",
						title: asset.name,
						detail: percent.format(change),
						at: new Date(ledger.anchor).toISOString(),
						link: assetLink(asset.id),
					},
				];
			});
			return [...transactionAlerts, ...moveAlerts].sort((first, second) =>
				second.at.localeCompare(first.at),
			);
		},
	});
}
