/**
 * Phone shell of the mobile preview: bezel, screen, status bar, and the home
 * indicator. `ios` draws an iPhone with a dynamic island; `android` draws a
 * Pixel with a punch-hole camera. Rendered by phone-preview.tsx, which puts
 * the app iframe inside. Pure presentation: no data, no copy from the dictionary.
 */

import { BatteryFull, Signal, Wifi } from "lucide-react";
import type { ReactNode } from "react";

import type { PhoneDevice } from "../../lib/constants";

/**
 * Outer size of the frame, CSS px. The iPhone 15 logical screen is 393×852.
 * The frame scales it by about 0.75, so the phone fits a 900 px tall window.
 */
const FRAME_WIDTH_PX = 304;
const FRAME_HEIGHT_PX = 640;

/** Bezel on each side, CSS px. The `p-[9px]` class of the frame draws it. */
const BEZEL_PX = 9;

/**
 * Width of the screen inside the bezel, CSS px. PhonePreview divides it by
 * the device width to scale the app down to the screen.
 */
export const PHONE_SCREEN_WIDTH_PX = FRAME_WIDTH_PX - 2 * BEZEL_PX;

// Mock chrome: the classic marketing clock of each vendor, not the real time.
const STATUS_BAR_TIME: Record<PhoneDevice, string> = {
	ios: "9:41",
	android: "18:42",
};

/** Props of the phone shell. The parent picks the device; the frame draws no data of its own. */
export type PhoneFrameProps = {
	/** `ios` or `android`, from the device toggle of the top bar. It selects the status bar and the home indicator. */
	device: PhoneDevice;
	/** The app screen, normally the preview iframe. It fills the space between the status bar and the home indicator. */
	children: ReactNode;
};

/** The frame has a fixed size; the parent centers it and scrolls when the window is shorter. */
export function PhoneFrame({ device, children }: PhoneFrameProps) {
	return (
		<div
			className="relative shrink-0 rounded-[46px] border border-white/15 bg-[#0a0a0c] p-[9px] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.8)]"
			style={{ width: FRAME_WIDTH_PX, height: FRAME_HEIGHT_PX }}
		>
			<div className="flex h-full w-full flex-col overflow-hidden rounded-[38px] bg-void text-white">
				<div className="relative flex h-11 shrink-0 items-center justify-between px-6 font-semibold text-[13px]">
					<span>{STATUS_BAR_TIME[device]}</span>
					{device === "ios" ? (
						<span className="absolute inset-x-0 top-[10px] mx-auto h-[26px] w-[90px] rounded-full bg-black" />
					) : (
						<span className="absolute inset-x-0 top-[12px] mx-auto size-3 rounded-full bg-black" />
					)}
					<span className="flex items-center gap-1">
						<Signal className="size-3.5" />
						<Wifi className="size-3.5" />
						<BatteryFull className="size-3.5" />
					</span>
				</div>
				<div className="min-h-0 flex-1">{children}</div>
				{device === "ios" ? (
					<div className="mx-auto mb-2 h-1 w-[120px] shrink-0 rounded-full bg-white/70" />
				) : (
					<div className="mx-auto mb-2 h-[3px] w-[90px] shrink-0 rounded-full bg-white/50" />
				)}
			</div>
		</div>
	);
}
