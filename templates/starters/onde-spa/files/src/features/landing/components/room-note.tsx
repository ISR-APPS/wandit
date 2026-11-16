// One room of the house: a lowercase label, a title, a sentence, and one fact in the display face.
// HouseSection renders four of them, two in each outer column of the triptych.
import { cn } from "~/shared/lib/utils";
import { BODY_TEXT, ITEM_TITLE, LABEL } from "../lib/styles";

type RoomNoteProps = {
	/** Translated room number, for example "room one". */
	label: string;
	/** Translated room name. */
	title: string;
	/** Translated sentence about the room. */
	body: string;
	/** One translated fact, a temperature or a word, for example "42°C" or "silence". */
	fact: string;
};

/** A block on a 16% hairline. */
export function RoomNote({ label, title, body, fact }: RoomNoteProps) {
	return (
		<div data-reveal="" className="border-(--onde-hair) border-t pt-[1.1rem]">
			<p className={LABEL}>{label}</p>
			<h3 className={cn(ITEM_TITLE, "mt-2")}>{title}</h3>
			<p
				className={cn(BODY_TEXT, "mt-[0.55rem] text-[0.93rem] leading-[1.65]")}
			>
				{body}
			</p>
			<span className="mt-[0.7rem] block font-display text-[1.05rem] text-primary tabular-nums">
				{fact}
			</span>
		</div>
	);
}
