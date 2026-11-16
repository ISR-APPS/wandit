// The pieces of the shop: the eight lines of the shelf. Six of them also have a photo on a plinth.
// The hero, the shelf, the window, the piece in focus, the quote band, and the reservation ledger read this list.
// The names, the materials, the dimensions, and the photo texts are in the "pieces" group of messages.ts.
import type { TranslationKey } from "~/shared/i18n";

/** The reference of a piece, as the shop prints it on the label. It is also the key in the basket. */
export type PieceRef =
	| "CL-001"
	| "EF-002"
	| "LT-004"
	| "PO-006"
	| "BR-009"
	| "NV-013"
	| "CT-017"
	| "CC-021";

/** The studio photo of a piece. Every photo is 1440 x 1920 px, one object on a bare ground. */
export type PiecePhoto = {
	/** Public path of the WebP file in public/images. */
	src: string;
	altKey: TranslationKey;
	/** The CSS object-position of the second view: the same photo at 136%, moved to this point. */
	closeUpPosition: string;
};

/** One line of the shelf. */
export type Piece = {
	ref: PieceRef;
	nameKey: TranslationKey;
	materialKey: TranslationKey;
	/** The sizes in cm or litres, as one text of messages.ts. A second language writes its own units there. */
	dimensionsKey: TranslationKey;
	/** Price in Algerian dinars, tax included, with no decimals. */
	price: number;
	/** False for a sold-out line. The line stays on the shelf, and no control can reserve it. */
	isInStock: boolean;
	/** Missing for a piece that has no plinth on the page. */
	photo?: PiecePhoto;
};

/** A piece that stands on a plinth: it always has a photo. */
export type PlinthPiece = Piece & { photo: PiecePhoto };

const CHAIR: PlinthPiece = {
	ref: "CL-001",
	nameKey: "pieces.chairName",
	materialKey: "pieces.chairMaterial",
	dimensionsKey: "pieces.chairDimensions",
	price: 48000,
	isInStock: true,
	photo: {
		src: "/images/chair.webp",
		altKey: "pieces.chairAlt",
		closeUpPosition: "50% 62%",
	},
};

const LAMP: PlinthPiece = {
	ref: "LT-004",
	nameKey: "pieces.lampName",
	materialKey: "pieces.lampMaterial",
	dimensionsKey: "pieces.lampDimensions",
	price: 26500,
	isInStock: true,
	photo: {
		src: "/images/lamp.webp",
		altKey: "pieces.lampAlt",
		closeUpPosition: "50% 26%",
	},
};

const TOTE: PlinthPiece = {
	ref: "CT-017",
	nameKey: "pieces.toteName",
	materialKey: "pieces.toteMaterial",
	dimensionsKey: "pieces.toteDimensions",
	price: 19500,
	isInStock: true,
	photo: {
		src: "/images/tote.webp",
		altKey: "pieces.toteAlt",
		closeUpPosition: "50% 60%",
	},
};

const VASE: PlinthPiece = {
	ref: "NV-013",
	nameKey: "pieces.vaseName",
	materialKey: "pieces.vaseMaterial",
	dimensionsKey: "pieces.vaseDimensions",
	price: 14800,
	isInStock: true,
	photo: {
		src: "/images/vase.webp",
		altKey: "pieces.vaseAlt",
		closeUpPosition: "52% 28%",
	},
};

const CARAFE: PlinthPiece = {
	ref: "CC-021",
	nameKey: "pieces.carafeName",
	materialKey: "pieces.carafeMaterial",
	dimensionsKey: "pieces.carafeDimensions",
	price: 6900,
	isInStock: true,
	photo: {
		src: "/images/carafe.webp",
		altKey: "pieces.carafeAlt",
		closeUpPosition: "50% 22%",
	},
};

const CANDLEHOLDER: PlinthPiece = {
	ref: "BR-009",
	nameKey: "pieces.candleholderName",
	materialKey: "pieces.candleholderMaterial",
	dimensionsKey: "pieces.candleholderDimensions",
	price: 4200,
	isInStock: true,
	photo: {
		src: "/images/candleholder.webp",
		altKey: "pieces.candleholderAlt",
		closeUpPosition: "50% 66%",
	},
};

const SHELF_UNIT: Piece = {
	ref: "EF-002",
	nameKey: "pieces.shelfName",
	materialKey: "pieces.shelfMaterial",
	dimensionsKey: "pieces.shelfDimensions",
	price: 31000,
	isInStock: true,
};

const TRAY: Piece = {
	ref: "PO-006",
	nameKey: "pieces.trayName",
	materialKey: "pieces.trayMaterial",
	dimensionsKey: "pieces.trayDimensions",
	price: 9400,
	isInStock: false,
};

/** The eight lines of the shelf, from the highest price to the lowest. */
export const SHELF_PIECES: readonly Piece[] = [
	CHAIR,
	SHELF_UNIT,
	LAMP,
	TOTE,
	VASE,
	TRAY,
	CARAFE,
	CANDLEHOLDER,
];

/** The three plinths of the hero. */
export const HERO_PIECES: readonly PlinthPiece[] = [VASE, LAMP, CARAFE];

/** The six plinths of the window, in their order of arrival in the shop. The scroll sorts them by price. */
export const WINDOW_PIECES: readonly PlinthPiece[] = [
	CARAFE,
	CHAIR,
	CANDLEHOLDER,
	LAMP,
	VASE,
	TOTE,
];

/** The piece in focus: one object with its full label. */
export const FOCUS_PIECE: PlinthPiece = CHAIR;

/** The piece that the buyer of the quote band owns. */
export const QUOTE_PIECE: PlinthPiece = TOTE;

/** A visitor can hold three pieces at most in one reservation. The shop states this limit under the total. */
export const MAX_RESERVED_PIECES = 3;

/** How many references the shop has in all. The hero and the shelf foot state it. */
export const STOCKROOM_COUNT = 38;

/** Writes a whole price in the French style of the shop: 14800 gives "14 800". Intl puts a narrow no-break space (U+202F). */
export function formatAmount(amount: number): string {
	return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
		amount,
	);
}
