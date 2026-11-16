// The four rooms of the visit, in walking order. RoomTour reads this list.
// Each room has one photo and the four facts of its reference strip. The texts are keys of the `visit` group.
import type { TranslationKey } from "~/shared/i18n";

/** One room of the tour. Every text field is a key of messages.ts. */
export type TourRoom = {
	/** Stable id for the React key. */
	id: string;
	/** Path of the photo under public/. */
	imageSrc: string;
	/** Pixel size of the photo file. */
	imageWidth: number;
	imageHeight: number;
	altKey: TranslationKey;
	/** The name on the plate, with its article: "The living room". */
	nameKey: TranslationKey;
	/** The short name under the progress rail. */
	tickKey: TranslationKey;
	/** The four strip values: room, surface, orientation, level. */
	roomKey: TranslationKey;
	surfaceKey: TranslationKey;
	orientationKey: TranslationKey;
	levelKey: TranslationKey;
};

/**
 * Four rooms of the estate: terrace, living room, bedroom, bath. The living room is the room of Villa Pin.
 * The tour starts on the terrace: the villa cards above already show the living room and the bedroom.
 */
export const TOUR_ROOMS: readonly TourRoom[] = [
	{
		id: "terrace",
		imageSrc: "/images/terrace.webp",
		imageWidth: 1600,
		imageHeight: 900,
		altKey: "visit.terraceAlt",
		nameKey: "visit.terraceName",
		tickKey: "visit.terraceTick",
		roomKey: "visit.terraceRoom",
		surfaceKey: "visit.terraceSurface",
		orientationKey: "visit.terraceOrientation",
		levelKey: "visit.terraceLevel",
	},
	{
		id: "living",
		imageSrc: "/images/living-room.webp",
		imageWidth: 1600,
		imageHeight: 900,
		altKey: "visit.livingAlt",
		nameKey: "visit.livingName",
		tickKey: "visit.livingTick",
		roomKey: "visit.livingRoom",
		surfaceKey: "visit.livingSurface",
		orientationKey: "visit.livingOrientation",
		levelKey: "visit.livingLevel",
	},
	{
		id: "bedroom",
		imageSrc: "/images/bedroom.webp",
		imageWidth: 1200,
		imageHeight: 1600,
		altKey: "visit.bedroomAlt",
		nameKey: "visit.bedroomName",
		tickKey: "visit.bedroomTick",
		roomKey: "visit.bedroomRoom",
		surfaceKey: "visit.bedroomSurface",
		orientationKey: "visit.bedroomOrientation",
		levelKey: "visit.bedroomLevel",
	},
	{
		id: "bath",
		imageSrc: "/images/bathroom.webp",
		imageWidth: 1200,
		imageHeight: 1600,
		altKey: "visit.bathAlt",
		nameKey: "visit.bathName",
		tickKey: "visit.bathTick",
		roomKey: "visit.bathRoom",
		surfaceKey: "visit.bathSurface",
		orientationKey: "visit.bathOrientation",
		levelKey: "visit.bathLevel",
	},
];
