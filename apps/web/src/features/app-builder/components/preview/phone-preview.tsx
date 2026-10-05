/**
 * Mobile stage of a mobile project: a bar with the target switch (web, iOS,
 * Android) and the actions of the target, then a dotted canvas with the
 * phone and, on a wide stage, the "Test on your phone" QR column. Rendered
 * by pages/app-builder-page.tsx. The web target shows the web build through
 * PreviewPanel; a device target streams Appetize through useDeviceSession.
 */

import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { Button } from "@wandit/ui/components/button";
import { useLayoutEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import {
	MOBILE_PREVIEW_TARGETS,
	type MobilePreviewTarget,
	PHONE_VIEWPORT_WIDTH_PX,
	type PhoneDevice,
} from "../../lib/constants";
import { useDeviceSession } from "../../lib/use-device-session";
import {
	type PreviewTokenDeps,
	usePreviewToken,
} from "../../lib/use-preview-token";
import { ExpoGoPanel, ExpoGoPopover } from "../shell/expo-go-popover";
import { SegmentedControl } from "../shell/segmented-control";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "../shell/top-bar";
import {
	DeviceBarControls,
	DeviceScreen,
	MOBILE_TARGET_ICON,
} from "./device-panel";
import {
	PHONE_FRAME_SIZE_PX,
	PHONE_SCREEN_WIDTH_PX,
	PhoneFrame,
	type PhoneFrameProps,
} from "./phone-frame";
import { PreviewPanel } from "./preview-panel";

/** Free space around the phone on the stage, CSS px. The `p-6` class of the stage row draws it. */
const STAGE_PADDING_PX = 24;

/**
 * Narrowest stage that shows the QR column, CSS px: the phone (340), the
 * gap (56), the column (264), and the padding fit in it.
 */
const QR_COLUMN_MIN_STAGE_WIDTH_PX = 720;

/**
 * Narrowest stage that shows the labels of every target in the switch, CSS
 * px. The three labels and the running session controls in French fit in it.
 */
const SWITCH_LABELS_MIN_STAGE_WIDTH_PX = 640;

/**
 * Narrowest stage whose bar shows the picked target label, the countdown
 * text, and the Stop label, CSS px. Below it the bar shows icons and the bare time.
 */
const FULL_BAR_MIN_STAGE_WIDTH_PX = 560;

/** Props of the mobile preview. The page reads them from the URL and the project query. */
export type PhonePreviewProps = {
	/** The open project. `name` fills the iframe title, `id` mints the preview token. */
	project: AppProject;
	/** `web`, `ios`, or `android`, from `?device=`. `web` shows the web build; the others stream a device. */
	target: MobilePreviewTarget;
	/** Stores the new target in the URL. The target switch of the bar calls it. */
	onChangeTarget: (target: MobilePreviewTarget) => void;
	/** Changes when the user presses reload or restores a version. Each change mints a new token. */
	reloadKey: number;
	/** Bumps `reloadKey` in the page. The reload button of the bar calls it. */
	onReload: () => void;
	/** The running turn and the backend state, from the page. The panel shows the start-up steps from them. */
	bootContext: BootContext;
	/** True when the user may run an Appetize device, from useDevicePreviewEnabled in the page. */
	canRunOnDevice: boolean;
	/** Spec seam: a fake getPreviewToken for usePreviewToken. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/**
 * The web build lays out at the iPhone width, then scales down to the
 * screen of the frame. The frame itself scales down on a short stage.
 */
export function PhonePreview({
	project,
	target,
	onChangeTarget,
	reloadKey,
	onReload,
	bootContext,
	canRunOnDevice,
	deps,
}: PhonePreviewProps) {
	const { t } = useTranslation();
	const preview = usePreviewToken(project.id, reloadKey, deps);
	// Without the device flag only the web build exists, so `?device=ios` shows it.
	const activeTarget: MobilePreviewTarget = canRunOnDevice ? target : "web";
	const devicePlatform = activeTarget === "web" ? null : activeTarget;
	const session = useDeviceSession(project.id, devicePlatform);
	// The web build wears the iPhone chrome.
	const device: PhoneDevice = devicePlatform ?? "ios";
	const isAppRunning = preview.status === "ready";

	// The stage size picks the phone scale, the QR column, and the bar labels.
	const stageRef = useRef<HTMLDivElement>(null);
	const [stageSize, setStageSize] = useState<{
		width: number;
		height: number;
	} | null>(null);
	useLayoutEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		// Measure once before paint, so the first frame has the right layout.
		setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				setStageSize({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});
		observer.observe(stage);
		return () => observer.disconnect();
	}, []);
	// A stage without a size (not laid out yet) keeps the design size.
	const hasStageSize = stageSize !== null && stageSize.width > 0;
	// The QR column mounts only when it shows: its mount mints a phone link.
	const showsQrColumn =
		hasStageSize && stageSize.width >= QR_COLUMN_MIN_STAGE_WIDTH_PX;
	const showsAllSwitchLabels =
		!hasStageSize || stageSize.width >= SWITCH_LABELS_MIN_STAGE_WIDTH_PX;
	const isCompactBar =
		hasStageSize && stageSize.width < FULL_BAR_MIN_STAGE_WIDTH_PX;
	const frameSize = PHONE_FRAME_SIZE_PX[device];
	const scale = hasStageSize
		? Math.max(
				Math.min(
					1,
					(stageSize.height - 2 * STAGE_PADDING_PX) / frameSize.height,
					(stageSize.width - 2 * STAGE_PADDING_PX) / frameSize.width,
				),
				// A collapsed stage must not flip the phone with a negative scale.
				0.1,
			)
		: 1;
	// The boot screen is dark, so the bands turn white only when the app can show.
	// LIMIT: they turn white on a ready token, up to one frame load before the
	// app shows. Upgrade: an onAppShownChange prop on PreviewPanel.
	let chrome: PhoneFrameProps["chrome"] =
		isAppRunning && bootContext.hasCodeChanges ? "light" : "dark";
	// A device stream draws its own status bar.
	if (devicePlatform !== null) chrome = "none";

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex h-12 shrink-0 items-center gap-2 border-night/[0.07] border-b px-3 dark:border-white/[0.07]">
				{canRunOnDevice ? (
					// The switch scrolls on a very narrow bar, so Stop and the countdown always stay in view.
					<div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						<SegmentedControl
							ariaLabel={t("appBuilder.device.ariaLabel")}
							value={activeTarget}
							onChange={onChangeTarget}
							options={MOBILE_PREVIEW_TARGETS.map((option) => ({
								value: option,
								label: t(`appBuilder.device.${option}`),
								icon: MOBILE_TARGET_ICON[option],
								iconOnly:
									isCompactBar ||
									(!showsAllSwitchLabels && option !== activeTarget),
							}))}
						/>
					</div>
				) : null}
				<div className="ms-auto flex shrink-0 items-center gap-1">
					{/* Every target keeps a way to the QR: the "Show QR" button of the Publish popover relies on it. */}
					{showsQrColumn ? null : (
						<ExpoGoPopover
							projectId={project.id}
							previewStatus={preview.status}
							onRetryPreview={preview.refresh}
						/>
					)}
					{devicePlatform === null ? (
						<IconAction label={t("appBuilder.mobileStage.reload")}>
							<Button
								variant="ghost"
								size="icon-sm"
								className={TOOLBAR_ICON_BUTTON_CLASS}
								onClick={onReload}
							>
								<ArrowClockwiseIcon aria-hidden weight="bold" />
							</Button>
						</IconAction>
					) : (
						<DeviceBarControls
							phase={session.phase}
							isCompact={isCompactBar}
							onStop={session.stop}
							onRestartApp={session.restartApp}
							onDevMenu={session.shake}
						/>
					)}
				</div>
			</div>
			<div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
				{/* The dots sit on their own layer: `bg-dots` carries a mask that would fade the phone too. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-dots"
				/>
				<div className="relative flex h-full items-center justify-center gap-14 p-6">
					{/* The box takes the scaled size, so the flex row centers what the eye sees. */}
					<div
						className="relative shrink-0"
						style={{
							width: frameSize.width * scale,
							height: frameSize.height * scale,
						}}
					>
						{/* Physical top-left origin: the box above has the scaled size in LTR and RTL. */}
						<div
							className="absolute top-0 left-0 origin-top-left"
							style={{ transform: `scale(${scale})` }}
						>
							<PhoneFrame device={device} chrome={chrome}>
								{/* The web build stays mounted under a device, so its app keeps its state. */}
								<div
									className={devicePlatform === null ? "contents" : "hidden"}
								>
									<PreviewPanel
										preview={preview}
										title={t("appBuilder.preview.frameTitle", {
											name: project.name,
										})}
										className="h-full w-full border-0"
										frameViewport={{
											widthPx: PHONE_VIEWPORT_WIDTH_PX.ios,
											scale:
												PHONE_SCREEN_WIDTH_PX / PHONE_VIEWPORT_WIDTH_PX.ios,
										}}
										bootContext={bootContext}
									/>
								</div>
								{devicePlatform === null ? null : (
									<DeviceScreen
										platform={devicePlatform}
										phase={session.phase}
										idleWarningSeconds={session.idleWarningSeconds}
										frameId={session.frameId}
										title={t("appBuilder.devicePreview.frameTitle", {
											device: t(`appBuilder.device.${devicePlatform}`),
											name: project.name,
										})}
										onStart={session.start}
									/>
								)}
							</PhoneFrame>
						</div>
					</div>
					{showsQrColumn ? (
						<aside className="scroll-warm max-h-full w-[264px] shrink-0 overflow-y-auto">
							<ExpoGoPanel
								projectId={project.id}
								previewStatus={preview.status}
								onRetryPreview={preview.refresh}
							/>
						</aside>
					) : null}
				</div>
			</div>
		</div>
	);
}
