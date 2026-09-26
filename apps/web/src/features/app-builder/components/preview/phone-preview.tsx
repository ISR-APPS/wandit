/**
 * Mobile preview: the device label row, a dotted canvas, and the phone frame
 * with the app iframe inside. Rendered by pages/app-builder-page.tsx for
 * mobile projects. PreviewPanel loads the real preview URL through the
 * preview-token route. Behind its flag, DevicePanel runs an Appetize device.
 */

import { Button } from "@wandit/ui/components/button";
import { ArrowLeft, Smartphone } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import { PHONE_VIEWPORT_WIDTH_PX, type PhoneDevice } from "../../lib/constants";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { DevicePanel } from "./device-panel";
import { PHONE_SCREEN_WIDTH_PX, PhoneFrame } from "./phone-frame";
import { PreviewPanel } from "./preview-panel";

/** Props of the mobile preview. The page reads them from the URL and the project query. */
export type PhonePreviewProps = {
	/** The open project. `name` fills the iframe title, `id` mints the preview token. */
	project: AppProject;
	/** `ios` or `android`, from the device toggle of the top bar. It selects the label and the phone chrome. */
	device: PhoneDevice;
	/** Changes when the user presses reload. The panel mints a new token for it. */
	reloadKey: number;
	/** The running turn and the backend state, from the page. The panel shows the start-up steps from them. */
	bootContext: BootContext;
	/** True when the user may run an Appetize device, from useDevicePreviewEnabled in the page. */
	canRunOnDevice: boolean;
	/** Spec seam: a fake getPreviewToken passed to the panel. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/**
 * The device switch changes the frame chrome and the layout width; the app
 * document is the same. The app lays out at the real device width, then
 * scales down to the screen of the frame.
 */
export function PhonePreview({
	project,
	device,
	reloadKey,
	bootContext,
	canRunOnDevice,
	deps,
}: PhonePreviewProps) {
	const { t } = useTranslation();
	// The device replaces the frame; the frame stays mounted, so its app keeps its state.
	const [isDeviceOpen, setIsDeviceOpen] = useState(false);
	const deviceLabel = t(
		device === "ios"
			? "appBuilder.device.iosLabel"
			: "appBuilder.device.androidLabel",
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex h-10 shrink-0 items-center justify-between px-4 text-muted-foreground text-xs">
				<span>{deviceLabel}</span>
				<span className="flex items-center gap-3">
					<span className="flex items-center gap-1.5">
						<span className="size-1.5 rounded-full bg-success" />
						{t("appBuilder.preview.liveReload")}
					</span>
					{canRunOnDevice ? (
						<Button
							variant="outline"
							size="sm"
							className="h-7 text-xs"
							onClick={() => setIsDeviceOpen((open) => !open)}
						>
							{isDeviceOpen ? (
								<ArrowLeft className="size-3.5 rtl:-scale-x-100" />
							) : (
								<Smartphone className="size-3.5" />
							)}
							{t(
								isDeviceOpen
									? "appBuilder.devicePreview.back"
									: "appBuilder.devicePreview.open",
							)}
						</Button>
					) : null}
				</span>
			</div>
			<div className="relative grid min-h-0 flex-1 place-items-center overflow-auto p-6">
				{/* The dots sit on their own layer: `bg-dots` carries a mask that would fade the phone too. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-dots"
				/>
				{/* A device switch remounts the panel, and the unmount ends the running session. */}
				{isDeviceOpen ? (
					<div className="relative flex h-full w-full max-w-[420px] flex-col">
						<DevicePanel
							key={device}
							projectId={project.id}
							platform={device}
							title={t("appBuilder.devicePreview.frameTitle", {
								device: deviceLabel,
								name: project.name,
							})}
						/>
					</div>
				) : null}
				<div className={isDeviceOpen ? "hidden" : "contents"}>
					<PhoneFrame device={device}>
						<PreviewPanel
							projectId={project.id}
							title={t("appBuilder.preview.frameTitle", {
								name: project.name,
							})}
							reloadKey={reloadKey}
							className="h-full w-full border-0"
							frameViewport={{
								widthPx: PHONE_VIEWPORT_WIDTH_PX[device],
								scale: PHONE_SCREEN_WIDTH_PX / PHONE_VIEWPORT_WIDTH_PX[device],
							}}
							bootContext={bootContext}
							deps={deps}
						/>
					</PhoneFrame>
				</div>
			</div>
		</div>
	);
}
