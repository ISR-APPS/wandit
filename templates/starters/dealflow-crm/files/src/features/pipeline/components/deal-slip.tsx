// One slip of the pipeline board: the deal name, the company, the amount, the age in the stage, and the owner.
// BoardColumn renders one slip per deal. The slip is a link to the deal page.
import { CheckCircleIcon, FlagPennantIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { formatAge, moneyFormat, PersonAvatar } from "~/features/crm";
import { type Deal, isStalled } from "~/features/deals";
import { useT } from "~/shared/i18n";

type DealSlipProps = {
	deal: Deal;
	/** The current time in milliseconds since 1970. The age in the stage counts from it. */
	now: number;
};

/** A stalled deal shows a flag and its age in the warning color. A won deal shows a check and the time since the win. */
export function DealSlip({ deal, now }: DealSlipProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const age = formatAge(deal.stageChangedAt, now, locale);
	return (
		<Link
			to="/app/deals/$dealId"
			params={{ dealId: deal.id }}
			// relative: the sr-only texts are absolute. Without it they escape the board and widen the page.
			className="border-(length:--surface-border-width) relative grid gap-2.5 rounded-surface border-(--surface-border-color) bg-card p-3 shadow-surface outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<span className="grid justify-items-start gap-0.5">
				<span
					className="line-clamp-2 font-medium text-sm leading-snug"
					dir="auto"
				>
					{deal.name}
				</span>
				<span
					className="max-w-full truncate text-muted-foreground text-xs"
					dir="auto"
				>
					{deal.companyName}
				</span>
			</span>
			<span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
				<span className="font-numeric font-semibold text-sm tabular-nums">
					{money.format(deal.amount)}
				</span>
				<span className="flex items-center gap-2">
					{deal.stage === "won" ? (
						<span className="inline-flex items-center gap-1 text-success text-xs tabular-nums">
							<CheckCircleIcon className="size-3.5" />
							{age}
						</span>
					) : isStalled(deal, now) ? (
						<span className="inline-flex items-center gap-1 font-medium text-warning text-xs tabular-nums">
							<FlagPennantIcon className="size-3.5" />
							<span className="sr-only">{t("deals.stalled")}</span>
							{age}
						</span>
					) : (
						<span className="text-muted-foreground text-xs tabular-nums">
							{age}
						</span>
					)}
					<PersonAvatar
						name={deal.ownerName}
						className="size-6 text-[0.625rem]"
					/>
					<span className="sr-only">{deal.ownerName}</span>
				</span>
			</span>
		</Link>
	);
}
