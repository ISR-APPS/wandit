/**
 * Mobile preview: the device label row, a dotted canvas, and the phone frame
 * with the app iframe inside. Rendered by pages/app-builder-page.tsx for
 * mobile projects. Shows MOCK_MOBILE_PREVIEW_HTML until the sandbox preview URL lands.
 */

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { PhoneDevice } from "../../lib/constants";
import { MOCK_MOBILE_PREVIEW_HTML } from "../../lib/mock-preview";
import { PhoneFrame } from "./phone-frame";

/** Props of the mobile preview. The page reads them from the URL and the project query. */
export type PhonePreviewProps = {
	/** The open project. Only `name` is read, for the iframe title. */
	project: AppProject;
	/** `ios` or `android`, from the device toggle of the top bar. It selects the label and the phone chrome. */
	device: PhoneDevice;
	/** Changes when the user presses reload. A new value remounts the iframe. */
	reloadKey: number;
};

/** The device switch changes the frame chrome only; the app document is the same. */
export function PhonePreview({
	project,
	device,
	reloadKey,
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
					<iframe
						key={reloadKey}
						srcDoc={MOCK_MOBILE_PREVIEW_HTML}
						title={t("appBuilder.preview.frameTitle", { name: project.name })}
						// An empty sandbox blocks scripts and navigation. The mock document needs neither.
						sandbox=""
						className="h-full w-full border-0"
					/>
				</PhoneFrame>
			</div>
		</div>
	);
}
