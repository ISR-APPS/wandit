/**
 * The Android APK card of the publish popover (WANDIT-194). It shows the
 * latest build, its action, a QR code of a finished APK, and the older builds.
 * Rendered by PublishMobileTargets in publish-popover.tsx. PublishMobileBody
 * there owns the builds query and the mutations. Draws the QR code with qrcode.react.
 */

import {
	MOBILE_BUILD_ANDROID_CREDITS,
	type MobileBuild,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Download, LoaderCircle, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { formatNumber, formatRelativeTime, useTranslation } from "@/lib/i18n";
import {
	LIVE_STATUSES,
	MOBILE_BUILDS_LIMIT,
} from "../../api/mobile-builds.queries";

// 96 px gives about 3 px per module for an EAS APK URL. A phone camera reads that from a screen.
const QR_SIZE_PX = 96;

/** What the card shows and does. PublishMobileBody fills it from mobileBuildsQuery and the two build mutations. */
export type AndroidBuildCardProps = {
	/** Newest first, from mobileBuildsQuery. The card shows the first MOBILE_BUILDS_LIMIT builds: the latest, then the history. Empty before the first build. */
	builds: MobileBuild[];
	/** True while the create request runs. The build button is disabled then. */
	isStarting: boolean;
	/** True while the cancel request runs. The Cancel button is disabled then. */
	isCanceling: boolean;
	/** Starts a new APK build. The API holds MOBILE_BUILD_ANDROID_CREDITS for it. */
	onBuild: () => void;
	/** Cancels the live build with this id. The API refunds its credits. */
	onCancel: (buildId: string) => void;
};

/**
 * One card: the state of the latest build with Cancel or Download, then the
 * QR code, the error text, or the wait hint, then the build button and the history.
 */
export function AndroidBuildCard({
	builds,
	isStarting,
	isCanceling,
	onBuild,
	onCancel,
}: AndroidBuildCardProps) {
	const { t, locale } = useTranslation();
	const latest = builds.at(0);
	// A create puts the new build first, so the cached list can hold one build too many until the next read.
	const olderBuilds = builds.slice(1, MOBILE_BUILDS_LIMIT);
	const liveBuild =
		latest && LIVE_STATUSES.has(latest.status) ? latest : undefined;
	const apkUrl = latest?.status === "finished" ? latest.artifactUrl : null;
	const priceParams = {
		count: MOBILE_BUILD_ANDROID_CREDITS,
		countDisplay: formatNumber(MOBILE_BUILD_ANDROID_CREDITS, locale),
	};

	return (
		<div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
			<div className="flex items-center gap-3">
				{liveBuild ? (
					<LoaderCircle
						aria-hidden
						className="size-4 shrink-0 animate-spin text-muted-foreground"
					/>
				) : (
					<Smartphone
						aria-hidden
						className="size-4 shrink-0 text-muted-foreground"
					/>
				)}
				<div className="min-w-0 flex-1">
					<div className="font-medium text-sm">
						{t("appBuilder.mobileBuilds.title")}
					</div>
					<div className="truncate text-muted-foreground text-xs">
						{latest
							? `${t(`appBuilder.mobileBuilds.status.${latest.status}`)} · ${formatRelativeTime(latest.completedAt ?? latest.createdAt, locale)}`
							: t("appBuilder.mobileBuilds.empty")}
					</div>
				</div>
				{liveBuild ? (
					<Button
						variant="outline"
						size="sm"
						disabled={isCanceling}
						onClick={() => onCancel(liveBuild.id)}
					>
						{t("appBuilder.mobileBuilds.cancel")}
					</Button>
				) : null}
				{apkUrl ? (
					<Button asChild size="sm">
						{/* `download` forces a save only for a same-origin URL. The EAS URL opens in a new tab instead. */}
						<a href={apkUrl} download target="_blank" rel="noopener noreferrer">
							<Download aria-hidden className="size-3.5" />
							{t("appBuilder.mobileBuilds.download")}
						</a>
					</Button>
				) : null}
			</div>
			{apkUrl ? (
				<div className="flex items-center gap-3">
					{/* Black on white in both themes: a phone camera cannot read a dark code. */}
					<div className="shrink-0 rounded-lg bg-white p-2">
						<QRCodeSVG
							value={apkUrl}
							size={QR_SIZE_PX}
							title={t("appBuilder.mobileBuilds.qrTitle")}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{t("appBuilder.mobileBuilds.scanHint")}
					</p>
				</div>
			) : null}
			{latest?.status === "failed" ? (
				<p className="text-destructive text-xs">
					{/* The contract allows a failed row without a code. The generic `internal` text covers it. */}
					{t(
						`appBuilder.mobileBuilds.errors.${latest.errorCode ?? "internal"}`,
					)}
				</p>
			) : null}
			{liveBuild ? (
				<p className="text-muted-foreground text-xs">
					{t("appBuilder.mobileBuilds.liveHint")}
				</p>
			) : (
				// A project runs one build at a time, so a live build shows the hint and no build button.
				<Button
					size="sm"
					variant={apkUrl ? "outline" : "default"}
					disabled={isStarting}
					onClick={onBuild}
				>
					{latest?.status === "failed"
						? t("appBuilder.mobileBuilds.retry", priceParams)
						: t("appBuilder.mobileBuilds.build", priceParams)}
				</Button>
			)}
			{olderBuilds.length > 0 ? (
				<div className="flex flex-col gap-1 border-t pt-2">
					<div className="text-muted-foreground text-xs">
						{t("appBuilder.mobileBuilds.history")}
					</div>
					<ul className="flex flex-col gap-1">
						{olderBuilds.map((build) => (
							<li key={build.id} className="flex items-center gap-2 text-xs">
								<span className="min-w-0 flex-1 truncate">
									{t(`appBuilder.mobileBuilds.status.${build.status}`)}
									{" · "}
									{formatRelativeTime(
										build.completedAt ?? build.createdAt,
										locale,
									)}
								</span>
								{build.status === "finished" && build.artifactUrl ? (
									<a
										href={build.artifactUrl}
										download
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline"
									>
										{t("appBuilder.mobileBuilds.download")}
									</a>
								) : null}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}
