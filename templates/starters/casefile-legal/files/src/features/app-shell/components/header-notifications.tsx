// The bell of the header: a dot when something needs the user, and a menu of the first alerts.
// AppHeader renders it. The alerts come from alertsQueryOptions of the core feature barrel (~/features/practice).
// Each item links to the record of the alert. Loading shows the bell with no dot; an error shows one sentence.
import { BellIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	alertsQueryOptions,
	fillMessage,
	formatRelativeTime,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";

// The menu lists the oldest alerts. The count names them all.
const SHOWN_ALERTS = 5;

/** The bell button and its menu. */
export function HeaderNotifications() {
	const { t, locale } = useT();
	const alerts = useQuery(alertsQueryOptions());
	const count = alerts.data?.length ?? 0;
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative"
					aria-label={
						count > 0
							? fillMessage(t("alerts.labelCount"), {
									count: number.format(count),
								})
							: t("alerts.title")
					}
				>
					<BellIcon />
					{count > 0 ? (
						<span className="absolute end-2 top-2 size-2 rounded-full bg-destructive" />
					) : null}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				<DropdownMenuLabel className="flex items-center justify-between gap-2">
					{t("alerts.title")}
					{count > 0 ? (
						<span className="font-normal text-muted-foreground text-xs tabular-nums">
							{fillMessage(t("alerts.newCount"), {
								count: number.format(count),
							})}
						</span>
					) : null}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{alerts.isError ? (
					<p className="px-2 py-4 text-muted-foreground text-sm" role="alert">
						{t("alerts.error")}
					</p>
				) : alerts.isPending ? (
					<p className="px-2 py-4 text-muted-foreground text-sm">
						{t("alerts.loading")}
					</p>
				) : count === 0 ? (
					<p className="px-2 py-4 text-muted-foreground text-sm">
						{t("alerts.empty")}
					</p>
				) : (
					alerts.data.slice(0, SHOWN_ALERTS).map((alert) => (
						<DropdownMenuItem key={`${alert.kind}-${alert.id}`} asChild>
							<Link {...alert.link} className="items-start gap-3">
								<span className="grid min-w-0 flex-1 gap-0.5">
									<span className="truncate font-medium text-sm" dir="auto">
										{alert.title}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{`${t(`alerts.kinds.${alert.kind}`)} · ${alert.detail}`}
									</span>
								</span>
								<time
									dateTime={alert.at}
									className="shrink-0 text-muted-foreground text-xs tabular-nums"
								>
									{formatRelativeTime(alert.at, now, locale)}
								</time>
							</Link>
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
