// The plinth plate: one object on the seamless tone, with a second view of the same photo.
// The hero, the window, and the quote band render it. landing.css draws the plate and the fade between the two views.
// A press, the keyboard focus, or the pointer shows the close view. The chip in the corner tells the visitor that it exists.
import { type CSSProperties, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { PlinthPiece } from "../lib/pieces";

type PlinthProps = {
	piece: PlinthPiece;
	/** True for a plate on the first screen: its photo loads at once. Other plates load when they come near the screen. */
	isEager?: boolean;
	/** True on the seamless band, where the plate takes the deeper tone. */
	isOnSeamless?: boolean;
};

/** A 3:4 plate. It is a toggle button, so a touch, a key, and a pointer all reach the second view. */
export function Plinth({
	piece,
	isEager = false,
	isOnSeamless = false,
}: PlinthProps) {
	const { t } = useT();
	const [isCloseUp, setIsCloseUp] = useState(false);
	const { photo } = piece;
	const loading = isEager ? "eager" : "lazy";
	return (
		<button
			type="button"
			aria-pressed={isCloseUp}
			aria-label={`${t(piece.nameKey)} — ${t("pieces.otherAngle")}`}
			onClick={() => setIsCloseUp((current) => !current)}
			className={cn(
				"nour-plinth aspect-3/4 cursor-pointer",
				isOnSeamless && "nour-plinth-deep",
			)}
			// SAFETY: React types have no custom properties. The key is a CSS variable that landing.css reads.
			style={{ "--nour-close-up": photo.closeUpPosition } as CSSProperties}
		>
			<img
				className="nour-close-up"
				src={photo.src}
				alt=""
				aria-hidden="true"
				width={1440}
				height={1920}
				loading={loading}
			/>
			<img
				className="nour-full-view"
				src={photo.src}
				alt={t(photo.altKey)}
				width={1440}
				height={1920}
				loading={loading}
			/>
			<span className="nour-mono absolute end-0 top-0 z-5 bg-background px-[7px] py-1 text-[9.5px] text-muted-foreground uppercase leading-none tracking-[0.1em]">
				{t("pieces.views")}
			</span>
		</button>
	);
}
