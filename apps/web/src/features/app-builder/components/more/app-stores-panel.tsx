/**
 * App stores panel of the More view, mobile apps only: the Android APK
 * builds with their state and download link, and an honest iPhone row
 * (WANDIT-284 builds iOS later). Rendered by components/more/more-view.tsx
 * inside PanelShell, which draws the title. Reads mobileBuildsQuery, the
 * same query as the publish popover; new builds start from that popover.
 */

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Smartphone } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-client";
import { formatRelativeTime, useTranslation } from "@/lib/i18n";
import { mobileBuildsQuery } from "../../api/mobile-builds.queries";

export type AppStoresPanelProps = {
	projectId: string;
};

export function AppStoresPanel({ projectId }: AppStoresPanelProps) {
	const { t, locale } = useTranslation();
	const builds = useQuery(mobileBuildsQuery(projectId));

	return (
		<>
			<section className="rounded-2xl border bg-card">
				<div className="px-4 py-3">
					<h2 className="flex items-center gap-2 font-semibold">
						<Smartphone className="size-4 shrink-0" strokeWidth={1.8} />
						{t("appBuilder.mobileBuilds.title")}
					</h2>
					<p className="text-muted-foreground text-xs">
						{t("appBuilder.appStores.androidHelp")}
					</p>
				</div>
				{/* A failed poll keeps the last list on screen. Only a first load without a list shows the error. */}
				{builds.data === undefined ? (
					builds.isError ? (
						<p className="border-t px-4 py-3 text-muted-foreground text-sm">
							{getApiErrorMessage(builds.error)}
						</p>
					) : (
						<Skeleton className="mx-4 mb-4 h-12" />
					)
				) : builds.data.items.length === 0 ? (
					<p className="border-t px-4 py-3 text-muted-foreground text-sm">
						{t("appBuilder.mobileBuilds.empty")}
					</p>
				) : (
					<ul>
						{builds.data.items.map((build) => (
							<li
								key={build.id}
								className="flex items-center gap-3 border-t px-4 py-3 text-sm"
							>
								<div className="min-w-0 flex-1">
									<p>{t(`appBuilder.mobileBuilds.status.${build.status}`)}</p>
									<p className="text-muted-foreground text-xs">
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
										className="text-primary text-xs hover:underline"
									>
										{t("appBuilder.mobileBuilds.download")}
									</a>
								) : null}
							</li>
						))}
					</ul>
				)}
			</section>
			<section className="rounded-2xl border bg-card px-4 py-3">
				<h2 className="flex items-center gap-2 font-semibold">
					<Smartphone className="size-4 shrink-0" strokeWidth={1.8} />
					{t("appBuilder.appStores.iphone")}
				</h2>
				<p className="text-muted-foreground text-sm">
					{t("appBuilder.appStores.iphoneNotAvailable")}
				</p>
			</section>
		</>
	);
}
