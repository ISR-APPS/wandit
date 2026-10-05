/**
 * App stores panel of the More view: the App Store and Google Play cards, then
 * the store listing checklist. Mobile apps only.
 * Rendered by components/more/more-view.tsx inside PanelShell, which draws the
 * title. Reads appStoresSummaryQuery; submit and connect have no backend yet.
 */

import type { Icon } from "@phosphor-icons/react";
import { AppleLogoIcon } from "@phosphor-icons/react/AppleLogo";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { CircleDashedIcon } from "@phosphor-icons/react/CircleDashed";
import { GooglePlayLogoIcon } from "@phosphor-icons/react/GooglePlayLogo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { formatNumber, type TranslationKey, useTranslation } from "@/lib/i18n";
import { appStoresSummaryQuery } from "../../api/app-builder.queries";
import type {
	AppProject,
	AppStoresSummary,
	StoreListingItemId,
} from "../../api/dto";
import {
	PANEL_CARD_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
} from "./panel-shell";

/** Props of the App stores panel of a mobile project. */
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

/** One label and value line of a store card. */
const STORE_FACT_CLASS =
	"flex justify-between gap-4 border-night/[0.07] border-t py-2.5 dark:border-white/[0.07]";

/**
 * The Google Play and App Store cards. It reads the mock store summary; submit
 * and connect show the not-wired toast until a store route exists.
 */
export function AppStoresPanel({ project }: AppStoresPanelProps) {
	const { t, locale } = useTranslation();
	const { data } = useSuspenseQuery(appStoresSummaryQuery(project.id));
	const notWired = () => toast(t("appBuilder.mock.notWired"));
	const doneCount = data.listing.filter((item) => item.done).length;

	return (
		<>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<StoreCard
					icon={AppleLogoIcon}
					title={t("appBuilder.appStores.appStore")}
					status={data.ios.status}
				>
					<dl className="px-5 font-sans text-[13px]">
						<div className={STORE_FACT_CLASS}>
							<dt className="text-night/55 dark:text-foreground/55">
								{t("appBuilder.appStores.bundleId")}
							</dt>
							<dd className="font-mono text-[12.5px] text-night dark:text-foreground">
								{data.ios.bundleId}
							</dd>
						</div>
						<div className={STORE_FACT_CLASS}>
							<dt className="text-night/55 dark:text-foreground/55">
								{t("appBuilder.appStores.latestBuild")}
							</dt>
							<dd className="font-grotesk font-medium text-night tabular-nums dark:text-foreground">
								{t("appBuilder.appStores.buildValue", {
									build: data.ios.latestBuild,
									version: project.versionNumber,
								})}
							</dd>
						</div>
						<div className={STORE_FACT_CLASS}>
							<dt className="text-night/55 dark:text-foreground/55">
								{t("appBuilder.appStores.testflight")}
							</dt>
							<dd className="font-grotesk font-medium text-night tabular-nums dark:text-foreground">
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
					<div className="mt-auto p-5 pt-3">
						<Button
							className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 w-full")}
							onClick={notWired}
						>
							{t("appBuilder.appStores.submitForReview")}
						</Button>
					</div>
				</StoreCard>

				<StoreCard
					icon={GooglePlayLogoIcon}
					title={t("appBuilder.appStores.googlePlay")}
					status={data.android.status}
				>
					<div className="px-5">
						<p className="border-night/[0.07] border-t pt-3 font-sans text-[13px] text-night/60 leading-relaxed dark:border-white/[0.07] dark:text-foreground/60">
							{t("appBuilder.appStores.googlePlayHelp")}
						</p>
					</div>
					<div className="mt-auto p-5 pt-4">
						<Button
							variant="outline"
							className={cn(PANEL_SECONDARY_BUTTON_CLASS, "h-10 w-full")}
							onClick={notWired}
						>
							{t("appBuilder.appStores.connectGooglePlay")}
						</Button>
					</div>
				</StoreCard>
			</div>

			<section className={PANEL_CARD_CLASS}>
				<div className="flex flex-col gap-3 px-5 py-4">
					<div className="flex items-center gap-2.5">
						<h2 className="font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
							{t("appBuilder.appStores.listingTitle")}
						</h2>
						<PanelChip
							tone={doneCount === data.listing.length ? "success" : "neutral"}
							className="tabular-nums"
						>
							{t("appBuilder.appStores.listingProgress", {
								done: formatNumber(doneCount, locale),
								total: formatNumber(data.listing.length, locale),
							})}
						</PanelChip>
					</div>
					{/* The bar repeats the "x of y done" chip as a picture. Screen readers read the chip. */}
					<div
						aria-hidden
						className="h-1.5 overflow-hidden rounded-full bg-night/[0.06] dark:bg-white/[0.08]"
					>
						<div
							className="h-full rounded-full bg-spark"
							style={{
								width: `${data.listing.length === 0 ? 0 : (doneCount / data.listing.length) * 100}%`,
							}}
						/>
					</div>
				</div>
				{data.listing.map((item) => (
					<div
						key={item.id}
						className="flex items-center gap-3 border-night/[0.07] border-t px-5 py-3 font-sans text-[14px] dark:border-white/[0.07]"
					>
						{item.done ? (
							<CheckCircleIcon
								aria-hidden
								weight="fill"
								className="size-5 shrink-0 text-success"
							/>
						) : (
							<CircleDashedIcon
								aria-hidden
								weight="bold"
								className="size-5 shrink-0 text-night/30 dark:text-foreground/30"
							/>
						)}
						<span
							className={cn(
								"flex-1 font-grotesk font-medium",
								item.done
									? "text-night dark:text-foreground"
									: "text-night/60 dark:text-foreground/60",
							)}
						>
							{t(LISTING_COPY[item.id])}
						</span>
						{/* An empty detail means the store still waits for this item. */}
						{item.detail === "" ? (
							<span className="font-grotesk font-medium text-[13px] text-ember-text">
								{t("appBuilder.appStores.neededForReview")}
							</span>
						) : (
							<span
								className="text-[13px] text-night/55 dark:text-foreground/55"
								dir="auto"
							>
								{item.detail}
							</span>
						)}
					</div>
				))}
			</section>
		</>
	);
}

/** One store card: the store medallion, its name, its status chip, then the facts and the button. */
function StoreCard({
	icon: StoreIcon,
	title,
	status,
	children,
}: {
	icon: Icon;
	/** Store name, a brand name from the dictionary. */
	title: string;
	status: AppStoresSummary["ios"]["status"];
	children: ReactNode;
}) {
	return (
		<section className={cn(PANEL_CARD_CLASS, "flex flex-col")}>
			<div className="flex items-center gap-3 px-5 py-4">
				<span
					aria-hidden
					className="grid size-9 shrink-0 place-items-center rounded-full bg-night text-paper dark:bg-white/[0.1] dark:text-foreground"
				>
					<StoreIcon weight="duotone" className="size-[18px]" />
				</span>
				<h2 className="min-w-0 flex-1 truncate font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
					{title}
				</h2>
				<StoreStatusChip status={status} />
			</div>
			{children}
		</section>
	);
}

/** Status chip of a store: ember when the build can go to review, neutral when nothing is set up. */
function StoreStatusChip({
	status,
}: {
	status: AppStoresSummary["ios"]["status"];
}) {
	const { t } = useTranslation();
	if (status === "readyToSubmit") {
		return (
			<PanelChip tone="ember">
				{t("appBuilder.appStores.readyToSubmit")}
			</PanelChip>
		);
	}
	return <PanelChip>{t("appBuilder.appStores.notSetUp")}</PanelChip>;
}
