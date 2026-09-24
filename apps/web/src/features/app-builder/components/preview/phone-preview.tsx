/**
 * Mobile preview: the device label row, a dotted canvas, and the phone frame
 * with the app iframe inside. Rendered by pages/app-builder-page.tsx for
 * mobile projects. PreviewPanel loads the real preview URL through the
 * preview-token route.
 */

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import type { PhoneDevice } from "../../lib/constants";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PhoneFrame } from "./phone-frame";
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
	/** Spec seam: a fake getPreviewToken passed to the panel. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/** The device switch changes the frame chrome only; the app document is the same. */
export function PhonePreview({
	project,
	device,
	reloadKey,
	bootContext,
	deps,
}: PhonePreviewProps) {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex h-10 shrink-0 items-center justify-between px-4 text-muted-foreground text-xs">
				<span>
					{t(
						device === "ios"
							? "appBuilder.device.iosLabel"
							: "appBuilder.device.androidLabel",
					)}
				</span>
				<span className="flex items-center gap-1.5">
					<span className="size-1.5 rounded-full bg-success" />
					{t("appBuilder.preview.liveReload")}
				</span>
			</div>
			<div className="relative grid min-h-0 flex-1 place-items-center overflow-auto p-6">
				{/* The dots sit on their own layer: `bg-dots` carries a mask that would fade the phone too. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-dots"
				/>
				<PhoneFrame device={device}>
					<PreviewPanel
						projectId={project.id}
						title={t("appBuilder.preview.frameTitle", {
							name: project.name,
						})}
						reloadKey={reloadKey}
						className="h-full w-full border-0"
						bootContext={bootContext}
						deps={deps}
					/>
				</PhoneFrame>
			</div>
		</div>
	);
}
