// The room tour, the one showpiece of the page: four rooms of one villa in a single frame.
// VisitSection renders it. A new room dissolves in over the old one, and one shared name plate and one shared strip are written again.
// A bronze fill under the frame is the clock: its CSS animation ends, and this component shows the next room.
// landing.css holds the layout, the clock, and the sheet of four rooms that shows with no script.
import { useRef, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useInView } from "../hooks/use-in-view";
import { TOUR_ROOMS } from "../lib/rooms";
import { ReferenceStrip, type StripCell } from "./reference-strip";

/** The state of the frame. `previousIndex` stays opaque under the arriving room. */
type TourState = {
	/** Index in TOUR_ROOMS of the room on screen. */
	activeIndex: number;
	/** Index of the room that was on screen before, or null at the start. */
	previousIndex: number | null;
	/** False after the visitor picks a room: the clock then stops for good. */
	isAuto: boolean;
};

const NAME_PLATE =
	"absolute start-0 top-0 z-3 border-foreground/12 border-e border-b bg-background px-[1.1rem] pt-[0.7rem] pb-[0.75rem] font-display text-[clamp(1rem,1.4vw,1.3rem)] leading-[1.3]";

/** The frame runs alone while half of it is in view. A click on a room name shows that room and stops the clock. */
export function RoomTour() {
	const { t } = useT();
	const frameRef = useRef<HTMLDivElement>(null);
	// Half of the frame on screen: the visitor sees the room, so the clock can run.
	const isInView = useInView(frameRef, 0.5);
	const [tour, setTour] = useState<TourState>({
		activeIndex: 0,
		previousIndex: null,
		isAuto: true,
	});

	const showRoom = (index: number, isAuto: boolean) => {
		setTour((current) =>
			index === current.activeIndex
				? { ...current, isAuto }
				: { activeIndex: index, previousIndex: current.activeIndex, isAuto },
		);
	};

	const stripCellsOf = (roomIndex: number): StripCell[] => {
		const room = TOUR_ROOMS[roomIndex];
		if (room === undefined) {
			return [];
		}
		return [
			{ label: t("visit.roomLabel"), value: t(room.roomKey) },
			{ label: t("visit.surfaceLabel"), value: t(room.surfaceKey) },
			{ label: t("visit.orientationLabel"), value: t(room.orientationKey) },
			{ label: t("visit.levelLabel"), value: t(room.levelKey) },
		];
	};

	const activeRoom = TOUR_ROOMS[tour.activeIndex];

	return (
		<div className="dlp-tour" data-auto={tour.isAuto} data-in-view={isInView}>
			<div ref={frameRef} data-reveal="lift" className="dlp-tour-frame">
				{TOUR_ROOMS.map((room, index) => (
					<figure
						key={room.id}
						className="dlp-room"
						data-state={
							index === tour.activeIndex
								? "active"
								: index === tour.previousIndex
									? "previous"
									: "idle"
						}
					>
						<img
							src={room.imageSrc}
							alt={t(room.altKey)}
							width={room.imageWidth}
							height={room.imageHeight}
							loading="lazy"
							decoding="async"
						/>
						<div className="dlp-room-own">
							<figcaption className={NAME_PLATE}>{t(room.nameKey)}</figcaption>
							<ReferenceStrip cells={stripCellsOf(index)} />
						</div>
					</figure>
				))}
				{activeRoom !== undefined && (
					// The keys start the short fade of landing.css again at each room.
					<>
						<p
							key={`name-${activeRoom.id}`}
							className={cn(NAME_PLATE, "dlp-tour-shared dlp-swap")}
						>
							{t(activeRoom.nameKey)}
						</p>
						<ReferenceStrip
							key={`strip-${activeRoom.id}`}
							cells={stripCellsOf(tour.activeIndex)}
							className="dlp-tour-shared dlp-swap"
						/>
					</>
				)}
			</div>
			<fieldset className="dlp-tour-rail mt-[clamp(1.2rem,2vw,1.7rem)] grid min-w-0 grid-cols-4 border-0 p-0">
				<legend className="sr-only">{t("visit.tourLabel")}</legend>
				{TOUR_ROOMS.map((room, index) => {
					const isActive = index === tour.activeIndex;
					return (
						<button
							key={room.id}
							type="button"
							aria-pressed={isActive}
							onClick={() => showRoom(index, false)}
							className={cn(
								"relative min-h-11 min-w-0 cursor-pointer border-foreground/12 border-t pt-[0.9rem] pb-2 text-start align-top font-semibold text-[10.5px] uppercase leading-[1.5] tracking-[0.12em] transition-colors duration-[400ms] hover:text-(--dlp-bronze-deep) sm:text-[10px] sm:tracking-[0.17em]",
								isActive ? "text-(--dlp-bronze-deep)" : "text-foreground/65",
							)}
						>
							{/* A bar of 3px on the rule. It is the only thing on the page that is thicker than a hairline. */}
							<span
								aria-hidden="true"
								className="dlp-tour-fill absolute start-0 -top-0.5 h-[3px] w-full bg-primary"
								data-fill={
									isActive
										? "active"
										: index < tour.activeIndex
											? "done"
											: "todo"
								}
								onAnimationEnd={() =>
									showRoom((index + 1) % TOUR_ROOMS.length, true)
								}
							/>
							{/* A long name takes two lines on a phone. The end gap of 12px keeps two names apart. */}
							<span className="block pe-3 sm:pe-2">{t(room.tickKey)}</span>
						</button>
					);
				})}
			</fieldset>
		</div>
	);
}
