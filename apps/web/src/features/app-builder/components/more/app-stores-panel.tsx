/**
 * App stores panel of the More view: the App Store and Google Play cards, then
 * the store listing checklist. Mobile apps only.
 * Rendered by components/more/more-view.tsx inside PanelShell, which draws the
 * title. Reads appStoresSummaryQuery; submit and connect have no backend yet.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Circle, CircleCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { formatNumber, type TranslationKey, useTranslation } from "@/lib/i18n";
import { appStoresSummaryQuery } from "../../api/app-builder.queries";
import type {
	AppProject,
	AppStoresSummary,
	StoreListingItemId,
} from "../../api/dto";

export type AppStoresPanelProps = {
	/** The build value shows `project.versionNumber` next to the build number. */
	project: AppProject;
};

/** Label key of each listing row. The ids come from the summary, the copy from the dictionary. */
const LISTING_COPY: Record<StoreListingItemId, TranslationKey> = {
	appIcon: "appBuilder.appStores.listing.appIcon",
	appName: "appBuilder.appStores.listing.appName",
	description: "appBuilder.appStores.listing.description",
	screenshots: "appBuilder.appStores.listing.screenshots",
	privacyUrl: "appBuilder.appStores.listing.privacyUrl",
	ageRating: "appBuilder.appStores.listing.ageRating",
};

export function AppStoresPanel({ project }: AppStoresPanelProps) {
	const { t, locale } = useTranslation();
	const { data } = useSuspenseQuery(appStoresSummaryQuery(project.id));
	const notWired = () => toast(t("appBuilder.mock.notWired"));
	const doneCount = data.listing.filter((item) => item.done).length;

	return (
		<>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<section className="rounded-2xl border bg-card">
					<div className="flex items-center justify-between gap-3 px-4 py-3">
						<h2 className="flex items-center gap-2 font-semibold">
							<Smartphone className="size-4 shrink-0" strokeWidth={1.8} />
							{t("appBuilder.appStores.appStore")}
						</h2>
						<StoreStatusBadge status={data.ios.status} />
					</div>
					<dl className="px-4 text-sm">
						<div className="flex justify-between gap-4 py-1.5">
							<dt className="text-muted-foreground">
								{t("appBuilder.appStores.bundleId")}
							</dt>
							<dd className="font-mono">{data.ios.bundleId}</dd>
						</div>
						<div className="flex justify-between gap-4 py-1.5">
							<dt className="text-muted-foreground">
								{t("appBuilder.appStores.latestBuild")}
							</dt>
							<dd>
								{t("appBuilder.appStores.buildValue", {
									build: data.ios.latestBuild,
									version: project.versionNumber,
								})}
							</dd>
						</div>
						<div className="flex justify-between gap-4 py-1.5">
							<dt className="text-muted-foreground">
								{t("appBuilder.appStores.testflight")}
							</dt>
							<dd>
								{t("appBuilder.appStores.testers", {
									count: data.ios.testflightTesters,
									countDisplay: formatNumber(
										data.ios.testflightTesters,
										locale,
									),
								})}
							</dd>
						</div>
					</dl>
					<div className="p-4 pt-3">
						<Button className="w-full" onClick={notWired}>
							{t("appBuilder.appStores.submitForReview")}
						</Button>
					</div>
				</section>

				<section className="rounded-2xl border bg-card">
					<div className="flex items-center justify-between gap-3 px-4 py-3">
						<h2 className="flex items-center gap-2 font-semibold">
							<Smartphone className="size-4 shrink-0" strokeWidth={1.8} />
							{t("appBuilder.appStores.googlePlay")}
						</h2>
						<StoreStatusBadge status={data.android.status} />
					</div>
					<p className="px-4 text-muted-foreground text-sm">
						{t("appBuilder.appStores.googlePlayHelp")}
					</p>
					<div className="p-4">
						<Button variant="outline" className="w-full" onClick={notWired}>
							{t("appBuilder.appStores.connectGooglePlay")}
						</Button>
					</div>
				</section>
			</div>

			<section className="rounded-2xl border bg-card">
				<div className="flex items-baseline gap-2 px-4 py-3">
					<h2 className="font-semibold">
						{t("appBuilder.appStores.listingTitle")}
					</h2>
					<span className="text-muted-foreground text-xs">
						{t("appBuilder.appStores.listingProgress", {
							done: formatNumber(doneCount, locale),
							total: formatNumber(data.listing.length, locale),
						})}
					</span>
				</div>
				{data.listing.map((item) => (
					<div
						key={item.id}
						className="flex items-center gap-3 border-t px-4 py-3 text-sm"
					>
						{item.done ? (
							<CircleCheck className="size-4 shrink-0 text-primary" />
						) : (
							<Circle className="size-4 shrink-0 text-faint" />
						)}
						<span
							className={cn("flex-1", !item.done && "text-muted-foreground")}
						>
							{t(LISTING_COPY[item.id])}
						</span>
						<span className="text-muted-foreground text-xs" dir="auto">
							{/* An empty detail means the store still waits for this item. */}
							{item.detail === ""
								? t("appBuilder.appStores.neededForReview")
								: item.detail}
						</span>
					</div>
				))}
			</section>
		</>
	);
}

/** Outline pill of a store: ember text when the build can go to review, muted when nothing is set up. */
function StoreStatusBadge({
	status,
}: {
	status: AppStoresSummary["ios"]["status"];
}) {
	const { t } = useTranslation();
	if (status === "readyToSubmit") {
		return (
			<Badge variant="outline" className="border-ember-text/40 text-ember-text">
				{t("appBuilder.appStores.readyToSubmit")}
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="text-muted-foreground">
			{t("appBuilder.appStores.notSetUp")}
		</Badge>
	);
}
