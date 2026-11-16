// The main scene of the page: a numbered room list beside one square photo that walks from room to room.
// RoomsSection renders it. In view, the visit advances alone: landing.css animates the hairline of the active row.
// A click on a row shows that room and stops the clock, so the visitor keeps the room.
// The server HTML holds the same stage, so the page height does not change at hydration.
// With no script, a noscript block shows the five rooms as framed photos.
import { useHydrated } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useInView } from "../hooks/use-in-view";
import { ROOMS } from "../lib/rooms";
import {
	GRID,
	MICRO_CAPS,
	NUMERAL,
	PHOTO_FRAME,
	PHOTO_GRADE,
} from "../lib/type-styles";
import { Aperture } from "./aperture";
import { Plinth } from "./plinth";
import { RoomPlan } from "./room-plan";

// One box for a row before and after hydration. The 2.75rem column puts the five names on one vertical line.
// The 0.75rem padding makes a row 45px high on a phone, enough for a finger.
const ROW_CLASS_NAME =
	"grid w-full grid-cols-[2.75rem_1fr] items-baseline gap-x-2 py-3 text-start";

// "idle" is the state before hydration: no room is marked, because the list is not a control yet.
function rowStateOf(index: number, activeIndex: number, isLive: boolean) {
	if (!isLive) {
		return "idle";
	}
	if (index === activeIndex) {
		return "active";
	}
	if (index < activeIndex) {
		return "done";
	}
	return "ahead";
}

// Where the photo of a room waits: on the stage, at the side it left by, or at the side it comes from.
function photoPlaceOf(index: number, activeIndex: number) {
	if (index === activeIndex) {
		return "on";
	}
	return index < activeIndex ? "before" : "after";
}

/** The itinerary of House N°7. It holds the index of the room on show, and whether the visitor selected it. */
export function RoomWalk() {
	const { t } = useT();
	const isLive = useHydrated();
	const stageRef = useRef<HTMLDivElement>(null);
	// The visit runs only while half of the stage is on screen.
	const isInView = useInView(stageRef, 0.5);
	const [activeIndex, setActiveIndex] = useState(0);
	// True after the first click on a row. The clock then stops for good, so the selected room stays.
	const [hasTakenControl, setHasTakenControl] = useState(false);
	const activeRoom = ROOMS[activeIndex];

	function showNextRoom() {
		// After the last room the visit starts again at the first one.
		setActiveIndex((index) => (index + 1) % ROOMS.length);
	}

	return (
		<div
			ref={stageRef}
			data-reveal="lift"
			data-mode={hasTakenControl ? "manual" : "auto"}
			data-playing={isLive && isInView}
			className={cn("ms-walk", GRID, "items-start gap-y-7")}
		>
			<div className="md:col-span-4">
				<div
					aria-hidden="true"
					className={cn(
						NUMERAL,
						"mb-4 border-foreground/10 border-b pb-2 text-[2.1rem] text-foreground leading-none md:mb-5 md:text-[clamp(2.4rem,5.6vw,4.6rem)]",
					)}
				>
					{/* The key restarts the lift animation each time the room changes. */}
					<span key={activeIndex} className="ms-walk-numeral inline-block">
						{activeRoom?.digits}
					</span>
				</div>
				<ol aria-label={t("rooms.listLabel")} className="ms-walk-list">
					{ROOMS.map((room, index) => {
						const rowState = rowStateOf(index, activeIndex, isLive);
						const isActive = rowState === "active";
						const rowText = (
							<>
								<span className={cn("ms-walk-number", MICRO_CAPS)}>
									{`${t("site.numberPrefix")}${room.digits}`}
								</span>
								<span className="ms-serif text-[clamp(1.05rem,1.5vw,1.35rem)] leading-tight">
									{t(room.nameKey)}
								</span>
								<span className="col-start-2 mt-0.5 hidden text-[0.82rem] text-muted-foreground sm:block">
									{t(room.factsKey)}
								</span>
							</>
						);
						return (
							<li
								key={room.id}
								data-state={rowState}
								className="relative ms-walk-row border-foreground/10 border-t last:border-b"
							>
								{/* Before hydration a row is plain text. A button that does nothing is a dead control. */}
								{isLive ? (
									<button
										type="button"
										aria-current={isActive ? "true" : undefined}
										onClick={() => {
											setActiveIndex(index);
											setHasTakenControl(true);
										}}
										className={cn(
											ROW_CLASS_NAME,
											"cursor-pointer transition-colors duration-300",
											isActive
												? "text-foreground"
												: "text-foreground/65 hover:text-foreground",
										)}
									>
										{rowText}
									</button>
								) : (
									<div className={ROW_CLASS_NAME}>{rowText}</div>
								)}
								<span
									aria-hidden="true"
									className="ms-walk-fill"
									onAnimationEnd={isActive ? showNextRoom : undefined}
								/>
							</li>
						);
					})}
				</ol>
				<div
					aria-hidden="true"
					className="relative ms-walk-live mt-5 h-0.5 bg-foreground/10"
				>
					<span
						className="absolute inset-y-0 start-0 ms-walk-rail bg-primary"
						style={{
							width: `${((activeIndex + 1) / ROOMS.length) * 100}%`,
						}}
					/>
				</div>
				<p className="ms-walk-live mt-3 text-[0.82rem] text-muted-foreground leading-relaxed">
					{t("rooms.walkHint")}
				</p>
				<div className="mt-[clamp(1.6rem,3vw,2.4rem)] hidden md:block">
					<RoomPlan activeRoomId={isLive ? (activeRoom?.id ?? null) : null} />
					<p className="mt-3 text-[0.78rem] text-muted-foreground leading-relaxed tracking-[0.02em]">
						{t("rooms.planCaption")}
					</p>
				</div>
			</div>

			{/* On a tablet the list column is taller than the photo. The photo then stays under the header, 5.5rem down. */}
			<div className="ms-walk-live md:sticky md:top-22 md:col-span-8 md:col-start-5">
				{/* The square never grows taller than the screen, so the list and the photo read together. */}
				<figure className="relative ms-auto ms-fig mb-14 w-full md:mb-8.5 md:max-w-[calc(100svh-9rem)]">
					<div className={cn(PHOTO_FRAME, "aspect-square")}>
						{ROOMS.map((room, index) => (
							<div
								key={room.id}
								aria-hidden={index !== activeIndex}
								data-place={photoPlaceOf(index, activeIndex)}
								className="absolute inset-0 ms-walk-room"
							>
								<img
									src={room.image.src}
									alt={t(room.altKey)}
									width={room.image.width}
									height={room.image.height}
									loading="lazy"
									decoding="async"
									className={cn(
										"size-full object-cover",
										PHOTO_GRADE,
										room.focusClassName,
									)}
								/>
							</div>
						))}
					</div>
					{/* One plinth for the five rooms. The legends share one grid cell, so the plate keeps one size.
					    The plate and its three lines copy the classes of plinth.tsx. Change the two files together. */}
					<figcaption className="absolute start-[clamp(12px,3vw,30px)] -bottom-10 ms-plinth grid max-w-[min(88%,340px)] border border-foreground/10 bg-card px-[0.95rem] pt-[0.6rem] pb-[0.68rem] md:-bottom-5">
						{ROOMS.map((room, index) => (
							<span
								key={room.id}
								aria-hidden={index !== activeIndex}
								data-on={index === activeIndex}
								className="col-start-1 row-start-1 ms-walk-legend block"
							>
								<span className={cn(MICRO_CAPS, "block")}>
									{t(room.plinthLabelKey)}
								</span>
								<span className="ms-serif mt-[0.3rem] block text-[clamp(0.94rem,1.1vw,1.1rem)] leading-tight">
									{t(room.plinthTitleKey)}
								</span>
								<span className="mt-1 block text-[0.82rem] text-muted-foreground leading-normal">
									{t(room.plinthNoteKey)}
								</span>
							</span>
						))}
					</figcaption>
				</figure>
			</div>

			{/* A browser with no script reads this block, and landing.css hides the stage above. */}
			<noscript className="md:col-span-8 md:col-start-5">
				<div className="grid gap-(--ms-gap) sm:grid-cols-2">
					{ROOMS.map((room) => (
						<Aperture
							key={room.id}
							src={room.image.src}
							alt={t(room.altKey)}
							width={room.image.width}
							height={room.image.height}
							shape="square"
							focusClassName={room.focusClassName}
							className="mb-14 md:mb-8.5"
						>
							<Plinth
								corner="bottom-start"
								label={t(room.plinthLabelKey)}
								title={t(room.plinthTitleKey)}
								note={t(room.plinthNoteKey)}
							/>
						</Aperture>
					))}
				</div>
			</noscript>
		</div>
	);
}
