// The side card of the home: a donut of the new users of the period, activated or not,
// and a footer with three counts in tinted round chips. OverviewPage renders it beside the event volume card.
// The donut file loads with React.lazy. The card has no header, as in the kit.
import {
	EnvelopeSimpleIcon,
	HourglassMediumIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardFooter } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ActivationDonut = lazy(() =>
	import("./activation-donut").then((module) => ({
		default: module.ActivationDonut,
	})),
);

type ActivationCardProps = {
	/** The new users of the period, the activated ones, and the ones that invited a teammate. */
	funnel: { signUps: number; activated: number; invited: number };
};

/** One count of the footer: a tinted chip, a label, and the count. */
type FooterCount = {
	key: string;
	label: string;
	value: number;
	icon: KitIcon;
	/** The token classes of the chip: a status color at low opacity, so the icon keeps its contrast. */
	tone: string;
};

/** The footer always has three columns. Each column puts its chip beside or above the text, by footer width. */
export function ActivationCard({ funnel }: ActivationCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const counts: FooterCount[] = [
		{
			key: "sign-ups",
			label: t("overview.activation.signUps"),
			value: funnel.signUps,
			icon: UserPlusIcon,
			tone: "border-success/40 bg-success/15 text-success",
		},
		{
			key: "not-activated",
			label: t("overview.activation.notActivated"),
			value: funnel.signUps - funnel.activated,
			icon: HourglassMediumIcon,
			tone: "border-warning/40 bg-warning/15 text-warning",
		},
		{
			key: "invited",
			label: t("overview.activation.invited"),
			value: funnel.invited,
			icon: EnvelopeSimpleIcon,
			tone: "border-info/40 bg-info/15 text-info",
		},
	];

	return (
		<Card className="h-full">
			<CardContent className="flex flex-1 items-center justify-center">
				<Suspense
					fallback={<Skeleton className="mx-auto size-64 rounded-full" />}
				>
					<ActivationDonut
						activated={funnel.activated}
						notActivated={funnel.signUps - funnel.activated}
					/>
				</Suspense>
			</CardContent>
			{/* The footer is its own container: the card is 12 columns wide on a tablet and 4 of 12 on a desktop. */}
			<CardFooter className="@container/counts border-t pt-6">
				<div className="grid w-full grid-cols-3 gap-4">
					{counts.map((count) => (
						// Under 28rem the chip sits above the text, so three labels fit beside each other.
						<div
							key={count.key}
							className="flex @md/counts:flex-row flex-col @md/counts:items-center @md/counts:gap-3 gap-2"
						>
							<span
								className={cn(
									"flex size-10 shrink-0 items-center justify-center rounded-full border",
									count.tone,
								)}
							>
								<count.icon className="size-4" />
							</span>
							<div className="grid min-w-0 gap-0.5">
								<span className="break-words text-sm">{count.label}</span>
								<span className="text-muted-foreground text-sm tabular-nums">
									{number.format(count.value)}
								</span>
							</div>
						</div>
					))}
				</div>
			</CardFooter>
		</Card>
	);
}
