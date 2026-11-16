// One gold frame of the reply card: four 1px lines that landing.css draws one after the other on the scroll.
// ReplyCard renders two of them, 6px apart: the double hairline of a reply card.
// Each line reads --voeu-scrub from the card, and --frame-inset and --frame-delay from this frame.
import type { CSSProperties } from "react";

type CardFrameProps = {
	/** Distance of the frame from the card edge, in px. */
	inset: number;
	/** Where the frame starts to draw, as a part of the card scroll from 0 to 1. */
	delay: number;
};

/** The four lines: top, end side, bottom, start side, in the order they draw. */
export function CardFrame({ inset, delay }: CardFrameProps) {
	const frame: CSSProperties & Record<`--frame-${string}`, string | number> = {
		"--frame-inset": `${inset}px`,
		"--frame-delay": delay,
	};
	return (
		<div aria-hidden="true" style={frame}>
			<span className="voeu-card-line" data-edge="top" />
			<span className="voeu-card-line" data-edge="end" />
			<span className="voeu-card-line" data-edge="bottom" />
			<span className="voeu-card-line" data-edge="start" />
		</div>
	);
}
