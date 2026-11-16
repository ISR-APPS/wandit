// The key moments card of the asset page: a timeline of the year high and low, the best and the worst day,
// and the first units of the user. AssetDetailPage renders it in the rail with the moments of the asset.
import type { ReactNode } from "react";
import {
	ChangeText,
	fillMessage,
	formatPrice,
	formatQuantity,
	formatRelativeTime,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KeyMoment } from "../lib/key-moments";

type KeyMomentsCardProps = {
	/** The ticker of the asset, for the quantity of the first units. */
	symbol: string;
	/** The moments of the asset, newest first. */
	moments: KeyMoment[];
};

// The value of one moment. Each kind has one value field: a price, a quantity, or a change.
function momentValue(
	moment: KeyMoment,
	symbol: string,
	locale: string,
): ReactNode {
	switch (moment.kind) {
		case "yearHigh":
		case "yearLow":
			return formatPrice(moment.price, locale);
		case "firstUnits":
			return `${formatQuantity(moment.quantity, locale)} ${symbol}`;
		case "bestDay":
		case "worstDay":
			return <ChangeText change={moment.change} />;
	}
}

/** One line per moment: a dot on a rail, the name, the value, and the day. */
export function KeyMomentsCard({ symbol, moments }: KeyMomentsCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("asset.momentsTitle")}</CardTitle>
				<CardDescription>{t("asset.momentsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ol className="grid">
					{moments.map((moment, index) => (
						<li key={moment.kind} className="flex gap-3">
							{/* The rail: a dot, then a line down to the next moment. */}
							<span aria-hidden="true" className="flex flex-col items-center">
								<span className="mt-1.5 size-2.5 shrink-0 rounded-full border border-chart-1 bg-chart-1/30" />
								{index === moments.length - 1 ? null : (
									<span className="w-px flex-1 bg-border" />
								)}
							</span>
							<div className="grid flex-1 gap-0.5 pb-5 text-sm">
								<div className="flex items-baseline justify-between gap-3">
									<span className="font-medium">
										{fillMessage(t(`asset.moments.${moment.kind}`), { symbol })}
									</span>
									<span className="tabular-nums">
										{momentValue(moment, symbol, locale)}
									</span>
								</div>
								<span className="text-muted-foreground text-xs">
									{`${date.format(new Date(moment.at))} · ${formatRelativeTime(moment.at, now, locale)}`}
								</span>
							</div>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
