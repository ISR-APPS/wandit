/**
 * Stage of a desktop project: a Windows 11 style window on the dotted canvas,
 * with the preview iframe as its content. web-preview.tsx renders it in place
 * of the full-width stage when the project kind is `desktop`. The app lays
 * out at a fixed window size, and the whole window scales down to fit the
 * stage, like the phone of phone-preview.tsx. Pure presentation: no data.
 */

import { AppWindowIcon } from "@phosphor-icons/react/AppWindow";
import { MinusIcon } from "@phosphor-icons/react/Minus";
import { SquareIcon } from "@phosphor-icons/react/Square";
import { XIcon } from "@phosphor-icons/react/X";
import { type ReactNode, useRef } from "react";

import { fitFrameScale } from "../../lib/helpers";
import { useElementSize } from "../../lib/use-element-size";

/**
 * Size of the window content, CSS px. 1024 px is the `lg` breakpoint, so the
 * app shows its desktop layout. 640 px keeps the 16:10 shape of a laptop.
 */
const WINDOW_CONTENT_SIZE_PX = { width: 1024, height: 640 };

/** Height of the title bar of a Windows 11 window, CSS px. */
const TITLE_BAR_HEIGHT_PX = 32;

/** The 1 px border on each side of the window, CSS px. */
const WINDOW_BORDER_PX = 1;

/** Outer size of the window, CSS px. The scale divides the stage by it. */
const WINDOW_SIZE_PX = {
	width: WINDOW_CONTENT_SIZE_PX.width + 2 * WINDOW_BORDER_PX,
	height:
		WINDOW_CONTENT_SIZE_PX.height + TITLE_BAR_HEIGHT_PX + 2 * WINDOW_BORDER_PX,
};

/** Free space around the window on the stage, CSS px. The `p-6` class of the stage row draws it. */
const STAGE_PADDING_PX = 24;

/** Props of the desktop stage. web-preview.tsx passes the project name and the preview panel. */
export type DesktopWindowStageProps = {
	/** Text of the title bar: the project name. The installed app shows its product name there. */
	title: string;
	/** The window content: the PreviewPanel with the app iframe. */
	children: ReactNode;
};

/** The window never grows past its design size. It shrinks on a small stage, so the app keeps its desktop layout. */
export function DesktopWindowStage({
	title,
	children,
}: DesktopWindowStageProps) {
	const stageRef = useRef<HTMLDivElement>(null);
	const scale = fitFrameScale(
		useElementSize(stageRef),
		WINDOW_SIZE_PX,
		STAGE_PADDING_PX,
	);

	return (
		<div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
			{/* The dots sit on their own layer: `bg-dots` carries a mask that would fade the window too. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-dots"
			/>
			<div className="relative flex h-full items-center justify-center p-6">
				{/* The box takes the scaled size, so the flex row centers what the eye sees. */}
				<div
					className="relative shrink-0"
					style={{
						width: WINDOW_SIZE_PX.width * scale,
						height: WINDOW_SIZE_PX.height * scale,
					}}
				>
					{/* Physical top-left origin: the box above has the scaled size in LTR and RTL. */}
					<div
						className="absolute top-0 left-0 flex origin-top-left flex-col overflow-hidden rounded-lg border border-night/[0.14] bg-white shadow-[0_1px_2px_rgb(11_16_51/0.1),0_28px_60px_-28px_rgb(11_16_51/0.45)] dark:border-white/[0.12] dark:bg-[#202020] dark:shadow-[0_32px_70px_-30px_rgb(0_0_0/0.8)]"
						style={{
							width: WINDOW_SIZE_PX.width,
							height: WINDOW_SIZE_PX.height,
							transform: `scale(${scale})`,
						}}
					>
						{/* Decoration only: the caption buttons do nothing in the preview. */}
						<div
							aria-hidden
							className="flex shrink-0 items-center font-sans text-[12px] text-night/80 dark:text-white/80"
							style={{ height: TITLE_BAR_HEIGHT_PX }}
						>
							<AppWindowIcon
								weight="duotone"
								className="ms-3 size-4 shrink-0 text-night/60 dark:text-white/60"
							/>
							<span className="ms-2 min-w-0 flex-1 truncate" dir="auto">
								{title}
							</span>
							{/* Windows 11 draws each caption button 46 px wide and mirrors the bar in RTL. */}
							<span className="grid h-full w-[46px] shrink-0 place-items-center">
								<MinusIcon weight="light" className="size-3.5" />
							</span>
							<span className="grid h-full w-[46px] shrink-0 place-items-center">
								<SquareIcon weight="light" className="size-3" />
							</span>
							<span className="grid h-full w-[46px] shrink-0 place-items-center">
								<XIcon weight="light" className="size-3.5" />
							</span>
						</div>
						<div className="relative min-h-0 flex-1">{children}</div>
					</div>
				</div>
			</div>
		</div>
	);
}
