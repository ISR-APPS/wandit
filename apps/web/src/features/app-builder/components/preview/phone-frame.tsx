/**
 * Phone body of the mobile stage: a titanium frame with side buttons, a
 * black bezel, and a screen with a dynamic island (iOS) or a punch-hole
 * camera (Android). Around the web build it also draws the iOS status band
 * and the home indicator band. Rendered by phone-preview.tsx, which puts
 * the app iframe or the device stream inside. Pure presentation: no data,
 * no copy from the dictionary.
 */

import { BatteryFullIcon } from "@phosphor-icons/react/BatteryFull";
import { CellSignalFullIcon } from "@phosphor-icons/react/CellSignalFull";
import { WifiHighIcon } from "@phosphor-icons/react/WifiHigh";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

import {
	MOBILE_VIEWPORT_HEIGHT_PX,
	PHONE_VIEWPORT_WIDTH_PX,
	type PhoneDevice,
} from "../../lib/constants";

/**
 * Width of the screen inside the bezel, CSS px. PhonePreview divides it by
 * the device width to scale the app down to the screen. At 320 px the
 * tallest frame (Pixel 8) fits the stage of a 1440×900 window.
 */
export const PHONE_SCREEN_WIDTH_PX = 320;

/** Logical screen height of each device, CSS px: iPhone 15 is 393×852, Pixel 8 is 412×915. */
const DEVICE_HEIGHT_PX: Record<PhoneDevice, number> = {
	ios: MOBILE_VIEWPORT_HEIGHT_PX,
	android: 915,
};

/**
 * Titanium rim (3 px) plus black bezel (7 px) on each side, CSS px. The
 * screen radius (46 px) is the body radius (56 px) minus it, so the curves
 * stay parallel.
 */
const FRAME_INSET_PX = 10;

/** Outer size of the frame of each device, CSS px. PhonePreview scales the whole frame down on a short stage. */
export const PHONE_FRAME_SIZE_PX: Record<
	PhoneDevice,
	{ width: number; height: number }
> = {
	ios: frameSizeOf("ios"),
	android: frameSizeOf("android"),
};

function frameSizeOf(device: PhoneDevice) {
	const screenHeightPx =
		(PHONE_SCREEN_WIDTH_PX * DEVICE_HEIGHT_PX[device]) /
		PHONE_VIEWPORT_WIDTH_PX[device];
	return {
		width: PHONE_SCREEN_WIDTH_PX + 2 * FRAME_INSET_PX,
		height: screenHeightPx + 2 * FRAME_INSET_PX,
	};
}

/** One side button, in percent of the frame height. The sides are physical: hardware does not mirror in RTL. */
type SideButton = { side: "left" | "right"; topPct: number; heightPct: number };

// Measured on product photos: iPhone 15 Pro (action, volume up, volume down; power), Pixel 8 (power; volume).
const SIDE_BUTTONS: Record<PhoneDevice, readonly SideButton[]> = {
	ios: [
		{ side: "left", topPct: 15, heightPct: 3.8 },
		{ side: "left", topPct: 22.5, heightPct: 7 },
		{ side: "left", topPct: 31, heightPct: 7 },
		{ side: "right", topPct: 25, heightPct: 11 },
	],
	android: [
		{ side: "right", topPct: 19, heightPct: 7 },
		{ side: "right", topPct: 30, heightPct: 13 },
	],
};

/** Props of the phone shell. The parent picks the device and the chrome; the frame draws no data of its own. */
export type PhoneFrameProps = {
	/** `ios` or `android`. It picks the camera cutout, the side buttons, and the screen height. The web build uses `ios`. */
	device: PhoneDevice;
	/**
	 * The iOS status band and home band around the screen content. `light`
	 * over the web app, `dark` over the dark boot screen, `none` for a device
	 * stream, which draws its own.
	 */
	chrome: "light" | "dark" | "none";
	/** The screen content: the preview iframe, or the device stream and its states. */
	children: ReactNode;
};

/** The frame has a fixed size. PhonePreview centers it and scales it to the stage. */
export function PhoneFrame({ device, chrome, children }: PhoneFrameProps) {
	const { width, height } = PHONE_FRAME_SIZE_PX[device];
	const bandClass =
		chrome === "light" ? "bg-white text-night" : "bg-night text-white";

	// The raw hex values of the body and the side buttons are titanium device colors, not brand colors.
	return (
		<div
			className="relative shrink-0 rounded-[56px] bg-[linear-gradient(150deg,#5b6075_0%,#2a2f45_18%,#171c36_45%,#262b42_72%,#50556b_100%)] p-[3px] shadow-[0_1px_2px_rgb(11_16_51/0.12),0_32px_64px_-28px_rgb(11_16_51/0.5),0_64px_110px_-56px_rgb(11_16_51/0.4)] ring-1 ring-black/40 dark:shadow-[0_40px_90px_-36px_rgb(0_0_0/0.8)]"
			style={{ width, height }}
		>
			{SIDE_BUTTONS[device].map((button) => (
				<span
					key={`${button.side}-${button.topPct}`}
					aria-hidden
					className={cn(
						"absolute w-[3px] bg-[#343950] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]",
						button.side === "left"
							? "-left-[3px] rounded-l-[2px]"
							: "-right-[3px] rounded-r-[2px]",
					)}
					style={{ top: `${button.topPct}%`, height: `${button.heightPct}%` }}
				/>
			))}
			{/* A thin light edge just inside the rim, like polished metal. */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-px rounded-[55px] ring-1 ring-white/10 ring-inset"
			/>
			<div className="relative h-full rounded-[53px] bg-black p-[7px]">
				{/* The night ground matches the boot screen, so the asleep and error states have no seam. */}
				<div className="relative flex h-full flex-col overflow-hidden rounded-[46px] bg-night">
					{/* The band of an iPhone 15 is 59 pt; scaled to the 320 px screen it is 48 px. */}
					{chrome === "none" ? null : (
						<div
							aria-hidden
							dir="ltr"
							className={cn(
								"grid h-12 shrink-0 grid-cols-[1fr_102px_1fr] items-center font-sans font-semibold text-[14px] tracking-[-0.01em] transition-colors duration-200",
								bandClass,
							)}
						>
							{/* The vendor marketing clock, not the real time. */}
							<span className="text-center">9:41</span>
							<span />
							<span className="flex items-center justify-center gap-[5px]">
								<CellSignalFullIcon weight="fill" className="size-[15px]" />
								<WifiHighIcon weight="fill" className="size-[15px]" />
								<BatteryFullIcon weight="fill" className="size-[21px]" />
							</span>
						</div>
					)}
					<div className="relative min-h-0 flex-1">{children}</div>
					{chrome === "none" ? null : (
						<div
							aria-hidden
							className={cn(
								"flex h-[26px] shrink-0 items-end justify-center pb-2 transition-colors duration-200",
								bandClass,
							)}
						>
							<span
								className={cn(
									"h-1 w-[108px] rounded-full transition-colors duration-200",
									chrome === "light" ? "bg-night" : "bg-white/80",
								)}
							/>
						</div>
					)}
					{/* The camera cutouts sit over the content, as on the real screens. */}
					{device === "ios" ? (
						<span
							aria-hidden
							className="pointer-events-none absolute top-[9px] left-1/2 h-[30px] w-[102px] -translate-x-1/2 rounded-full bg-black"
						/>
					) : (
						<span
							aria-hidden
							className="pointer-events-none absolute top-[11px] left-1/2 size-[11px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/[0.06]"
						/>
					)}
				</div>
			</div>
		</div>
	);
}
