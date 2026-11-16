// The 1px floor plan of the upper level of House N°7, in the language of the glyphs.
// RoomWalk renders it under the room list. The room on show fills with stone at 16%.
import { useT } from "~/shared/i18n";
import { ROOMS, type Room } from "../lib/rooms";

type RoomPlanProps = {
	/** Id of the room on show. Null before hydration: then no room has a fill. */
	activeRoomId: Room["id"] | null;
};

/** Line plan with the five numbered rooms. It is a picture, not a control: the list beside it selects a room. */
export function RoomPlan({ activeRoomId }: RoomPlanProps) {
	const { t } = useT();
	return (
		<svg
			viewBox="0 0 300 190"
			role="img"
			aria-label={t("rooms.planLabel")}
			className="block h-auto w-full"
		>
			{ROOMS.map((room) => (
				<rect
					key={room.id}
					x={room.plan.x}
					y={room.plan.y}
					width={room.plan.width}
					height={room.plan.height}
					data-on={room.id === activeRoomId}
					className="fill-transparent transition-[fill] duration-500 data-[on=true]:fill-primary/16"
				/>
			))}
			<g className="fill-none stroke-foreground/45" strokeWidth={1}>
				{/* The outer walls, then the partitions. */}
				<path d="M8 8h284v174H8z" vectorEffect="non-scaling-stroke" />
				<path
					d="M150 8v96M8 104h284M8 134h284M170 134v48"
					vectorEffect="non-scaling-stroke"
				/>
				{/* One window in the south wall of the living room, one in the east wall of the kitchen. */}
				<path d="M12 40v34M288 44v30" vectorEffect="non-scaling-stroke" />
				{/* The corridor door and its swing. */}
				<path
					d="M104 104v30M104 134a15 15 0 0 0 15-15"
					vectorEffect="non-scaling-stroke"
				/>
			</g>
			{ROOMS.map((room) => (
				<text
					key={room.id}
					x={room.plan.x + 10}
					y={room.plan.y + 18}
					className="fill-foreground/45 font-medium text-[8.5px] tracking-[0.14em]"
				>
					{room.digits}
				</text>
			))}
		</svg>
	);
}
