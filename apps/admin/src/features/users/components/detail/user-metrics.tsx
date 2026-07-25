import {
	CoinsIcon,
	FilesIcon,
	Globe2Icon,
	MessageSquareMoreIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { AdminUserDetail } from "@/features/users/api/users.dto";
import {
	formatCompactNumber,
	formatMinorCurrency,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

type UserMetricsProps = {
	user: AdminUserDetail;
};

export function UserMetrics({ user }: UserMetricsProps) {
	const metrics = [
		{
			label: "Credit balance",
			value: formatWholeNumber(user.creditsBalance),
			exactValue: formatWholeNumber(user.creditsBalance),
			detail: "Available now",
			icon: CoinsIcon,
		},
		{
			label: "Tokens this period",
			value: formatCompactNumber(user.tokensThisPeriod),
			exactValue: formatWholeNumber(user.tokensThisPeriod),
			detail: `${formatCompactNumber(user.tokensLifetime)} lifetime · ${formatMinorCurrency(user.tokenCostUsdMinor, "USD")} cost`,
			icon: MessageSquareMoreIcon,
		},
		{
			label: "Websites generated",
			value: formatWholeNumber(user.websitesGenerated),
			exactValue: formatWholeNumber(user.websitesGenerated),
			detail: `${formatWholeNumber(user.websites.length)} retained`,
			icon: Globe2Icon,
		},
		{
			label: "Assets generated",
			value: formatWholeNumber(user.assetsGenerated),
			exactValue: formatWholeNumber(user.assetsGenerated),
			detail: `${formatWholeNumber(user.assets.length)} retained`,
			icon: FilesIcon,
		},
	] as const;

	return (
		<Card className="gap-0 py-0 shadow-none">
			<CardContent className="grid grid-cols-1 px-0 sm:grid-cols-2 xl:grid-cols-4">
				{metrics.map((metric, index) => {
					const Icon = metric.icon;

					return (
						<div
							key={metric.label}
							className="flex min-w-0 items-start gap-3 border-b p-4 last:border-b-0 sm:nth-[2n+1]:border-r sm:nth-last-[-n+2]:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0"
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<Icon aria-hidden="true" />
							</div>
							<dl className="min-w-0">
								<dt className="truncate text-muted-foreground text-xs">
									{metric.label}
								</dt>
								<dd
									className="mt-1 font-semibold text-2xl tabular-nums tracking-tight"
									title={metric.exactValue}
								>
									{metric.value}
								</dd>
								<dd className="mt-1 truncate text-muted-foreground text-xs">
									{metric.detail}
								</dd>
							</dl>
							<span className="sr-only">{index + 1} of 4 metrics</span>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
