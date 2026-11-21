// The key moments card of the asset page: a line timeline of the year high and low, the best and the worst day,
// and the first units of the user. Each step has an icon, a title with its value, the date, and one sentence.
// AssetDetailPage renders it under the price chart in the Overview tab.
import {
	ArrowFatDownIcon,
	ArrowFatUpIcon,
	ClockIcon,
	TrendDownIcon,
	TrendUpIcon,
	WalletIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
	ChangeText,
	fillMessage,
	formatPrice,
	formatQuantity,
	signedPercentFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { KeyMoment } from "../lib/key-moments";

/** One icon per kind of moment. */
const MOMENT_ICONS = {
	yearHigh: TrendUpIcon,
	yearLow: TrendDownIcon,
	bestDay: ArrowFatUpIcon,
	worstDay: ArrowFatDownIcon,
	firstUnits: WalletIcon,
} satisfies Record<KeyMoment["kind"], KitIcon>;

type KeyMomentsCardProps = {
	/** The ticker of the asset, for the units of the first transaction. */
	symbol: string;
	/** The moments of the asset, newest first. */
	moments: KeyMoment[];
};

// The card shows the 3 newest moments, so it keeps the height of the timeline card of the kit profile page.
const SHOWN_MOMENTS = 3;

/** The newest moment gets a "Latest" badge. */
export function KeyMomentsCard({ symbol, moments }: KeyMomentsCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const signedPercent = signedPercentFormat(locale);

	// The value of one moment as plain text for its sentence, and as a node for its title.
	function momentValue(moment: KeyMoment): { text: string; node: ReactNode } {
		switch (moment.kind) {
			case "yearHigh":
			case "yearLow": {
				const text = formatPrice(moment.price, locale);
				return { text, node: text };
			}
			case "firstUnits": {
				const text = `${formatQuantity(moment.quantity, locale)} ${symbol}`;
				return { text, node: text };
			}
			case "bestDay":
			case "worstDay":
				return {
					text: signedPercent.format(moment.change),
					node: <ChangeText change={moment.change} />,
				};
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("asset.momentsTitle")}</CardTitle>
				<CardDescription>{t("asset.momentsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ol className="ms-3 grid gap-8 border-s">
					{moments.slice(0, SHOWN_MOMENTS).map((moment, index) => {
						const Icon = MOMENT_ICONS[moment.kind];
						const value = momentValue(moment);
						return (
							<li key={moment.kind} className="relative grid gap-1.5 ps-6">
								<span
									aria-hidden="true"
									className="absolute -start-3 top-0 flex size-6 items-center justify-center rounded-full bg-muted ring-4 ring-card"
								>
									<Icon className="size-3.5" />
								</span>
								<p className="flex flex-wrap items-center gap-2 font-semibold">
									{fillMessage(t(`asset.moments.${moment.kind}`), { symbol })}
									<span className="font-normal tabular-nums">{value.node}</span>
									{index === 0 ? (
										<Badge variant="outline">{t("asset.latest")}</Badge>
									) : null}
								</p>
								<p className="flex items-center gap-1.5 text-muted-foreground text-sm">
									<ClockIcon className="size-3.5" />
									{date.format(new Date(moment.at))}
								</p>
								<p className="text-muted-foreground text-sm">
									{fillMessage(t(`asset.momentNotes.${moment.kind}`), {
										value: value.text,
										symbol,
									})}
								</p>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
