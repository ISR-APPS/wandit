/**
 * App stores panel of the More view, mobile apps only: the Android APK
 * builds with their state and download link, and an honest iPhone row
 * (WANDIT-284 builds iOS later). Rendered by components/more/more-view.tsx
 * inside PanelShell, which draws the title. Reads mobileBuildsQuery, the
 * same query as the publish popover; new builds start from that popover.
 */

import type { Icon } from "@phosphor-icons/react";
import { AndroidLogoIcon } from "@phosphor-icons/react/AndroidLogo";
import { AppleLogoIcon } from "@phosphor-icons/react/AppleLogo";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

import { getApiErrorMessage } from "@/lib/api-client";
import { formatRelativeTime, useTranslation } from "@/lib/i18n";
import { mobileBuildsQuery } from "../../api/mobile-builds.queries";
import { PANEL_CARD_CLASS } from "./panel-shell";

export type AppStoresPanelProps = {
	projectId: string;
};

/** Hairline row inside a store card: one build, an empty list, or a failed load. */
const STORE_ROW_CLASS =
	"border-night/[0.07] border-t px-5 py-3 font-sans text-[14px] dark:border-white/[0.07]";

export function AppStoresPanel({ projectId }: AppStoresPanelProps) {
	const { t, locale } = useTranslation();
	const builds = useQuery(mobileBuildsQuery(projectId));

	return (
		<>
			<StoreCard
				icon={AndroidLogoIcon}
				title={t("appBuilder.mobileBuilds.title")}
				help={t("appBuilder.appStores.androidHelp")}
			>
				{/* A failed poll keeps the last list on screen. Only a first load without a list shows the error. */}
				{builds.data === undefined ? (
					builds.isError ? (
						<p
							className={cn(
								STORE_ROW_CLASS,
								"text-night/60 dark:text-foreground/60",
							)}
						>
							{getApiErrorMessage(builds.error)}
						</p>
					) : (
						<Skeleton className="mx-5 mb-4 h-12 rounded-[14px]" />
					)
				) : builds.data.items.length === 0 ? (
					<p
						className={cn(
							STORE_ROW_CLASS,
							"text-night/60 dark:text-foreground/60",
						)}
					>
						{t("appBuilder.mobileBuilds.empty")}
					</p>
				) : (
					<ul>
						{builds.data.items.map((build) => (
							<li
								key={build.id}
								className={cn(STORE_ROW_CLASS, "flex items-center gap-3")}
							>
								<div className="min-w-0 flex-1">
									<p className="font-grotesk font-medium text-night dark:text-foreground">
										{t(`appBuilder.mobileBuilds.status.${build.status}`)}
									</p>
									<p
										className={cn(
											"text-[13px]",
											build.status === "failed"
												? "text-destructive"
												: "text-night/55 dark:text-foreground/55",
										)}
									>
										{build.status === "failed"
											? // The contract allows a failed row without a code. The generic `internal` text covers it.
												t(
													`appBuilder.mobileBuilds.errors.${build.errorCode ?? "internal"}`,
												)
											: formatRelativeTime(
													build.completedAt ?? build.createdAt,
													locale,
												)}
									</p>
								</div>
								{build.status === "finished" && build.artifactUrl ? (
									<a
										href={build.artifactUrl}
										download
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex shrink-0 items-center gap-1.5 font-grotesk font-medium text-[13px] text-ember-text hover:underline"
									>
										<DownloadSimpleIcon
											aria-hidden
											weight="bold"
											className="size-3.5"
										/>
										{t("appBuilder.mobileBuilds.download")}
									</a>
								) : null}
							</li>
						))}
					</ul>
				)}
			</StoreCard>
			<StoreCard
				icon={AppleLogoIcon}
				title={t("appBuilder.appStores.iphone")}
				help={t("appBuilder.appStores.iphoneNotAvailable")}
			/>
		</>
	);
}

/** One store card: the store medallion, its name and help line, then the rows. */
function StoreCard({
	icon: StoreIcon,
	title,
	help,
	children,
}: {
	icon: Icon;
	/** Translated card title, for example "Android · APK". */
	title: string;
	/** Translated line under the title. */
	help: string;
	children?: ReactNode;
}) {
	return (
		<section className={PANEL_CARD_CLASS}>
			<div className="flex items-center gap-3 px-5 py-4">
				<span
					aria-hidden
					className="grid size-9 shrink-0 place-items-center rounded-full bg-night text-paper dark:bg-white/[0.1] dark:text-foreground"
				>
					<StoreIcon weight="duotone" className="size-[18px]" />
				</span>
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
						{title}
					</h2>
					<p className="font-sans text-[13px] text-night/55 dark:text-foreground/55">
						{help}
					</p>
				</div>
			</div>
			{children}
		</section>
	);
}
