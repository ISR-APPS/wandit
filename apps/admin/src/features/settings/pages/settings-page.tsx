import {
	AlertCircleIcon,
	Clock3Icon,
	RefreshCwIcon,
	UserRoundIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useProductSettingsQuery } from "@/features/settings/api/settings.queries";
import { BillingOpsCard } from "@/features/settings/components/billing-ops-card";
import { ProductControlsCard } from "@/features/settings/components/product-controls-card";
import { SettingsPageSkeleton } from "@/features/settings/components/settings-page-skeleton";
import { SignupGrantBackfillCard } from "@/features/settings/components/signup-grant-backfill-card";

const settingsDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	month: "short",
	year: "numeric",
});

export function SettingsPage() {
	const settingsQuery = useProductSettingsQuery();

	if (settingsQuery.isLoading) {
		return <SettingsPageSkeleton />;
	}

	if (!settingsQuery.data) {
		return (
			<div className="mx-auto w-full max-w-[1600px]">
				<Empty className="min-h-(--content-full-height) border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<AlertCircleIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Could not load product settings</EmptyTitle>
						<EmptyDescription>
							The current controls could not be read. No settings were changed.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void settingsQuery.refetch()}>
							<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
							Try again
						</Button>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	const settings = settingsQuery.data;

	async function reloadSettings() {
		const result = await settingsQuery.refetch();

		if (result.error) {
			throw result.error;
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
			{settingsQuery.isError ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-destructive text-sm"
				>
					<span>
						The displayed settings could not be refreshed and may be stale.
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void settingsQuery.refetch()}
					>
						<RefreshCwIcon aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}
			<header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
				<div className="flex max-w-3xl flex-col gap-2">
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Product operations
					</p>
					<h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Control purchase availability and promotional credits. Every switch
						requires confirmation before it reaches the server.
					</p>
				</div>

				<dl className="flex flex-col gap-2 text-sm lg:items-end">
					<div className="flex flex-wrap items-center gap-2">
						<dt className="sr-only">Settings version</dt>
						<dd>
							<Badge variant="outline">Version {settings.version}</Badge>
						</dd>
						<Clock3Icon className="text-muted-foreground" aria-hidden="true" />
						<dt className="sr-only">Updated at</dt>
						<dd className="text-muted-foreground">
							<time dateTime={settings.updatedAt}>
								{formatSettingsDateTime(settings.updatedAt)}
							</time>
						</dd>
					</div>
					<div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
						<UserRoundIcon aria-hidden="true" />
						<dt>Updated by</dt>
						<dd
							className="max-w-72 truncate font-mono text-foreground text-xs"
							title={settings.updatedBy ?? "System"}
						>
							{settings.updatedBy ?? "System"}
						</dd>
					</div>
				</dl>
			</header>

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)] xl:items-start">
				<ProductControlsCard
					settings={settings}
					reloadSettings={reloadSettings}
				/>
				<div className="flex flex-col gap-6">
					<SignupGrantBackfillCard settings={settings} />
					<BillingOpsCard />
				</div>
			</div>
		</div>
	);
}

function formatSettingsDateTime(value: string) {
	return settingsDateTimeFormatter.format(new Date(value));
}
