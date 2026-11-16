// The studio at seven in the morning, drawn in CSS: an arched window, light beams, the cast of the window
// on a cork floor, three mats, a pendant lamp, dust motes, and a plant. StudioSection renders it.
// The room scrub moves the light across the floor, and the caption clock ticks from 07:04 to 07:52.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useRoomClock } from "../hooks/use-room-clock";
import { useScrollProgress } from "../hooks/use-scroll-progress";

/** The room, 380px to 640px tall. It is one image for assistive technology, with a text description. */
export function StudioRoom() {
	const { t } = useT();
	const roomRef = useRef<HTMLDivElement>(null);
	const clock = useRoomClock(roomRef);
	// Progress 0 when the room top enters at the screen bottom, 1 when the room bottom leaves at the top.
	useScrollProgress(roomRef, "--room", { startAt: 1, endAt: 0 });
	return (
		<div data-reveal className="px-2.5">
			<div
				ref={roomRef}
				role="img"
				aria-label={t("studio.roomArt")}
				className="sp-room sp-band relative mx-auto h-[clamp(470px,58vw,640px)] max-w-[1420px] overflow-hidden rounded-2xl"
			>
				<div className="sp-pendant" />
				<div className="sp-window" />
				<div className="sp-light">
					<div data-beam="1" className="sp-beam" />
					<div data-beam="2" className="sp-beam" />
					<div className="sp-cast" />
					<div data-pool="1" className="sp-pool" />
					<div data-pool="2" className="sp-pool" />
					<div data-mote="1" className="sp-mote" />
					<div data-mote="2" className="sp-mote" />
					<div data-mote="3" className="sp-mote" />
					<div data-mote="4" className="sp-mote" />
				</div>
				<div data-mat="1" className="sp-mat" />
				<div data-mat="2" className="sp-mat" />
				<div data-mat="3" className="sp-mat" />
				<svg
					viewBox="0 0 200 260"
					fill="none"
					aria-hidden="true"
					className="sp-plant"
				>
					<path
						d="M100 260 C 100 200 96 150 84 108"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<path
						d="M84 108 C 60 96 44 70 46 40 C 74 46 92 70 88 100"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						fill="currentColor"
						fillOpacity=".9"
					/>
					<path
						d="M100 260 C 104 196 112 150 130 116"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<path
						d="M130 116 C 152 108 172 84 174 52 C 144 58 124 82 126 112"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						fill="currentColor"
						fillOpacity=".9"
					/>
					<path
						d="M100 260 C 98 226 92 200 78 178"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<path
						d="M78 178 C 58 174 40 158 34 134 C 60 134 78 152 80 174"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						fill="currentColor"
						fillOpacity=".9"
					/>
					<path
						d="M64 260 L 136 260 L 128 218 L 72 218 Z"
						fill="currentColor"
					/>
				</svg>
				<p className="start-[18px] bottom-4 font-bold font-sans text-(--sp-ink-64) text-[0.68rem] uppercase tabular-nums tracking-[0.22em] sm:start-[26px] sm:bottom-[22px] sm:tracking-[0.3em]">
					{clock} {t("studio.roomCaption")}
				</p>
			</div>
		</div>
	);
}
