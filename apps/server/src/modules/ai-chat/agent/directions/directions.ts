// Wandit curated design library.
// This file IS the product's taste: every entry is hand-vetted, editing it is a design decision.
// Deliberate exclusions: no violet/purple family (the model's default favorite), no Inter/Roboto/Open Sans.

export type Energy = "quiet" | "medium" | "loud";
export type PriceFeel = "accessible" | "premium";

export interface Tagged {
	id: string;
	name: string;
	mood: string[];
	energy: Energy;
	priceFeel: PriceFeel;
	/** soft affinity — a hint for the director, never a lock */
	industries?: string[];
	/** hard exclusion — never offer for these */
	avoidFor?: string[];
}

export interface Palette extends Tagged {
	roles: {
		bg: string;
		surface: string;
		ink: string;
		accent: string;
		accent2?: string;
	};
	note: string;
}

export interface FontPairing extends Tagged {
	display: string;
	body: string;
	source: "google" | "fontshare" | "mixed";
	/** Arabic equivalents (all Google Fonts) — used when the page language is Arabic */
	arabicDisplay: string;
	arabicBody: string;
	note: string;
}

export interface Skeleton extends Tagged {
	hero: string;
	flow: string[];
	note: string;
}

export interface SignatureInteraction extends Tagged {
	behavior: string;
}

export interface MotionVocab extends Tagged {
	moves: string[];
	note: string;
}

// ─────────────────────────────────────────────── PALETTES (16)

export const palettes: Palette[] = [
	{
		id: "sable-atlas",
		name: "Sable Atlas",
		roles: {
			bg: "#F1E8DA",
			surface: "#E8DCC8",
			ink: "#221A12",
			accent: "#C4552D",
		},
		mood: ["warm", "earthy", "sunlit"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["food", "crafts", "home"],
		note: "Desert warmth — terracotta on sand, generous and honest.",
	},
	{
		id: "espresso-bronze",
		name: "Espresso & Bronze",
		roles: {
			bg: "#14100C",
			surface: "#1E1712",
			ink: "#EDE4D4",
			accent: "#B08D57",
		},
		mood: ["cinematic", "hushed", "luxurious"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["jewelry", "real-estate", "perfume"],
		note: "Dark editorial luxury — bronze glints on near-black espresso.",
	},
	{
		id: "mediterranee",
		name: "Méditerranée",
		roles: {
			bg: "#F7F3EB",
			surface: "#EFE8DA",
			ink: "#0F2A43",
			accent: "#2E7EA6",
			accent2: "#E9A13B",
		},
		mood: ["coastal", "fresh", "optimistic"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["travel", "food", "summer-goods"],
		note: "Sea blue and citrus on warm paper — Algiers bay in daylight.",
	},
	{
		id: "zellige-teal",
		name: "Zellige",
		roles: {
			bg: "#F4EFE4",
			surface: "#EAE2D0",
			ink: "#113536",
			accent: "#17756C",
			accent2: "#C87D3F",
		},
		mood: ["artisan", "heritage", "crafted"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["crafts", "ceramics", "decor"],
		note: "Teal glaze and copper — Maghreb tilework made typographic.",
	},
	{
		id: "noir-acide",
		name: "Noir Acide",
		roles: {
			bg: "#0B0B0D",
			surface: "#141417",
			ink: "#E8E4DA",
			accent: "#D4FF4F",
		},
		mood: ["rebellious", "urban", "electric"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["streetwear", "gaming", "fitness"],
		avoidFor: ["funeral", "medical"],
		note: "Void black with violent chartreuse — streetwear energy.",
	},
	{
		id: "oxblood-blush",
		name: "Oxblood & Blush",
		roles: {
			bg: "#F4E3DD",
			surface: "#EDD5CC",
			ink: "#3A1219",
			accent: "#8E2233",
		},
		mood: ["sensual", "refined", "feminine"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["beauty", "fashion", "perfume"],
		note: "Deep oxblood on blush — beauty without pink clichés.",
	},
	{
		id: "sauge-craie",
		name: "Sauge & Craie",
		roles: {
			bg: "#F2F1EA",
			surface: "#E9E8DE",
			ink: "#23291F",
			accent: "#6F7D5C",
			accent2: "#B96C4B",
		},
		mood: ["natural", "calm", "honest"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["organic", "skincare", "wellness"],
		note: "Sage and clay on chalk — quiet natural confidence.",
	},
	{
		id: "cobalt-papier",
		name: "Cobalt Papier",
		roles: {
			bg: "#FAF7F0",
			surface: "#F1ECE0",
			ink: "#14161C",
			accent: "#2742D6",
		},
		mood: ["modern", "sharp", "intellectual"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["tech", "services", "education"],
		note: "One decisive cobalt on warm paper — Swiss with a pulse.",
	},
	{
		id: "safran-encre",
		name: "Safran & Encre",
		roles: {
			bg: "#FBF5E9",
			surface: "#F3EAD6",
			ink: "#191512",
			accent: "#E0A526",
			accent2: "#1E4D3B",
		},
		mood: ["appetizing", "generous", "warm"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["food", "spices", "restaurant"],
		note: "Saffron gold and deep green on ivory — food you can smell.",
	},
	{
		id: "minuit-menthe",
		name: "Minuit Menthe",
		roles: {
			bg: "#0D1517",
			surface: "#152023",
			ink: "#E6F1EC",
			accent: "#58C9A5",
		},
		mood: ["nocturnal", "cool", "techy"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["tech", "gadgets", "fitness"],
		note: "Deep night teal with mint glow — dark mode without purple.",
	},
	{
		id: "henna-creme",
		name: "Henna & Crème",
		roles: {
			bg: "#F8F0E3",
			surface: "#F0E4CF",
			ink: "#2A1A10",
			accent: "#A34A24",
			accent2: "#D9A441",
		},
		mood: ["traditional", "warm", "celebratory"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["beauty", "wedding", "gifts"],
		note: "Henna rust and gold on cream — heritage made contemporary.",
	},
	{
		id: "olive-beurre",
		name: "Olive & Beurre",
		roles: {
			bg: "#F6EDD2",
			surface: "#EFE3BE",
			ink: "#2C2A1C",
			accent: "#70712F",
		},
		mood: ["rustic", "wholesome", "sunny"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["grocery", "olive-oil", "organic"],
		note: "Olive on butter — a Kabylie pantry in two colors.",
	},
	{
		id: "ardoise-corail",
		name: "Ardoise & Corail",
		roles: {
			bg: "#EEF0F2",
			surface: "#E3E7EA",
			ink: "#232B33",
			accent: "#F0644B",
		},
		mood: ["friendly", "clean", "trustworthy"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["health", "services", "apps"],
		note: "Slate calm with a coral heartbeat — approachable competence.",
	},
	{
		id: "dune-rose",
		name: "Dune Rose",
		roles: {
			bg: "#F5E9E2",
			surface: "#EDDBD0",
			ink: "#472F28",
			accent: "#C98A78",
			accent2: "#7A4A3A",
		},
		mood: ["soft", "cozy", "intimate"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["home", "candles", "baby"],
		note: "Dusty rose and cocoa — warmth at whisper volume.",
	},
	{
		id: "atlas-cedre",
		name: "Atlas Cèdre",
		roles: {
			bg: "#14211B",
			surface: "#1C2B23",
			ink: "#EFEAD8",
			accent: "#A8763E",
		},
		mood: ["outdoors", "grounded", "sturdy"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["outdoor", "leather", "coffee"],
		note: "Forest dark with cedar wood — mountain air, not tech dark-mode.",
	},
	{
		id: "blanc-galerie",
		name: "Blanc Galerie",
		roles: {
			bg: "#FCFBF8",
			surface: "#F4F2EC",
			ink: "#1A1A18",
			accent: "#C22B1F",
		},
		mood: ["minimal", "gallery", "bold"],
		energy: "loud",
		priceFeel: "premium",
		industries: ["fashion", "design", "art"],
		note: "Gallery white, near-black ink, one violent red. Nothing else.",
	},
	{
		id: "indigo-sahel",
		name: "Indigo Sahel",
		roles: {
			bg: "#F4F1E8",
			surface: "#EAE6D8",
			ink: "#1B2440",
			accent: "#3D52A0",
			accent2: "#C9A86A",
		},
		mood: ["dignified", "deep", "classic"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["tailoring", "books", "finance"],
		note: "Tuareg indigo and sand gold — depth without darkness.",
	},
	{
		id: "corail-marine",
		name: "Corail Marine",
		roles: {
			bg: "#101A2B",
			surface: "#18243A",
			ink: "#F2E9DD",
			accent: "#FF6B5A",
		},
		mood: ["energetic", "nocturnal", "confident"],
		energy: "loud",
		priceFeel: "premium",
		industries: ["sport", "gadgets", "apps"],
		note: "Coral fire on deep navy — dark mode with a heartbeat.",
	},
	{
		id: "pistache-cacao",
		name: "Pistache & Cacao",
		roles: {
			bg: "#F7F2E7",
			surface: "#EFE7D5",
			ink: "#33261D",
			accent: "#A8C686",
			accent2: "#8A5A3B",
		},
		mood: ["fresh", "sweet", "artisanal"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["desserts", "gelato", "café"],
		note: "Gelato counter colors — appetite at first glance.",
	},
	{
		id: "acier-safran",
		name: "Acier & Safran",
		roles: {
			bg: "#1A1D21",
			surface: "#23272D",
			ink: "#E9E7E2",
			accent: "#F2A93B",
		},
		mood: ["industrial", "capable", "sturdy"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["tools", "workshop", "auto"],
		note: "Workshop steel with a safety-orange soul — hands-on trust.",
	},
	{
		id: "lin-graphite",
		name: "Lin Graphite",
		roles: {
			bg: "#F0EBE1",
			surface: "#E7E0D2",
			ink: "#262119",
			accent: "#262119",
			accent2: "#7A4B26",
		},
		mood: ["monochrome", "typographic", "severe"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["tailoring", "architecture", "consulting"],
		note: "Ink on linen, nearly no color — typography does everything.",
	},
	{
		id: "citron-ardoise",
		name: "Citron & Ardoise",
		roles: {
			bg: "#FBFAF5",
			surface: "#F2F1E8",
			ink: "#2A3038",
			accent: "#E8C929",
		},
		mood: ["optimistic", "clear", "modern"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["services", "education", "apps"],
		note: "Slate seriousness lit by one lemon stroke.",
	},
	{
		id: "brique-ciel",
		name: "Brique & Ciel",
		roles: {
			bg: "#F8F4EC",
			surface: "#EFE8DB",
			ink: "#4A2C22",
			accent: "#9E3B2B",
			accent2: "#BFD9E4",
		},
		mood: ["heritage", "local", "warm"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["restaurant", "guesthouse", "bakery"],
		note: "Brick red and a sliver of sky — old town charm.",
	},
	{
		id: "braise-crepuscule",
		name: "Braise Crépuscule",
		roles: {
			bg: "#1C1310",
			surface: "#271B15",
			ink: "#F5E7D7",
			accent: "#FF7847",
			accent2: "#FFC24B",
		},
		mood: ["smoky", "appetizing", "night"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["street-food", "grill", "delivery"],
		note: "Ember orange and honey on charcoal — night food energy.",
	},
	{
		id: "eucalyptus-or",
		name: "Eucalyptus & Or",
		roles: {
			bg: "#24382F",
			surface: "#2D4439",
			ink: "#EFEDE2",
			accent: "#C9A227",
		},
		mood: ["serene", "ritual", "premium"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["spa", "hammam", "wellness"],
		note: "Deep eucalyptus with gold leaf — a hammam at dusk.",
	},
	{
		id: "cerise-vanille",
		name: "Cerise & Vanille",
		roles: {
			bg: "#F9F1E0",
			surface: "#F2E6CE",
			ink: "#3B1F23",
			accent: "#B4233A",
		},
		mood: ["festive", "sweet", "generous"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["pastry", "gifts", "events"],
		note: "Cherry on vanilla — celebration you can taste.",
	},
	{
		id: "bleu-majorelle",
		name: "Bleu Majorelle",
		roles: {
			bg: "#F6F4EC",
			surface: "#ECE9DD",
			ink: "#171A2E",
			accent: "#2B3FBF",
			accent2: "#E2953F",
		},
		mood: ["artistic", "cultured", "bold"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["art", "decor", "culture"],
		note: "Majorelle garden blue — Maghreb modernism in one pigment.",
	},
	{
		id: "tabac-miel",
		name: "Tabac & Miel",
		roles: {
			bg: "#F3E9D9",
			surface: "#EADCC4",
			ink: "#3B2A18",
			accent: "#C9862B",
			accent2: "#6B4A2B",
		},
		mood: ["leathery", "heritage", "masculine"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["leather", "coffee", "barber"],
		note: "Tobacco and honey — a well-worn satchel of a palette.",
	},
	{
		id: "menthe-glacee",
		name: "Menthe Glacée",
		roles: {
			bg: "#EAF4EE",
			surface: "#DEEDE4",
			ink: "#1E2B26",
			accent: "#2F8F6B",
		},
		mood: ["clean", "fresh", "reassuring"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["pharmacy", "health", "dental"],
		note: "Clinical freshness without hospital coldness.",
	},
	{
		id: "papier-scotch",
		name: "Papier & Scotch",
		roles: {
			bg: "#F5F5F2",
			surface: "#ECECE7",
			ink: "#111111",
			accent: "#FFD400",
		},
		mood: ["brutalist", "direct", "promo"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["drops", "promo", "youth"],
		avoidFor: ["luxury-quiet"],
		note: "Black type, white paper, one strip of warning-tape yellow.",
	},
	{
		id: "aurore-ardoise",
		name: "Aurore & Ardoise",
		roles: {
			bg: "#F7EDE6",
			surface: "#F0E2D6",
			ink: "#35404A",
			accent: "#E1745F",
		},
		mood: ["soft", "creative", "contemporary"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["photography", "studio", "beauty"],
		note: "Dawn pink against slate blue — gentle but never naive.",
	},
];

// ─────────────────────────────────────────── FONT PAIRINGS (16)
// Latin pair + Arabic equivalents (Google) for RTL pages.
// Arabic display tip: skip italics in Arabic — accent with weight and color instead.

export const fontPairings: FontPairing[] = [
	{
		id: "clash-satoshi",
		name: "Clash & Satoshi",
		display: "Clash Display",
		body: "Satoshi",
		source: "fontshare",
		arabicDisplay: "Changa",
		arabicBody: "Tajawal",
		mood: ["modern", "premium", "confident"],
		energy: "medium",
		priceFeel: "premium",
		note: "Contemporary product-brand default done right.",
	},
	{
		id: "fraunces-instrument",
		name: "Fraunces & Instrument",
		display: "Fraunces (variable, use optical sizes + italics)",
		body: "Instrument Sans",
		source: "google",
		arabicDisplay: "Amiri",
		arabicBody: "Readex Pro",
		mood: ["editorial", "luxurious", "literary"],
		energy: "quiet",
		priceFeel: "premium",
		note: "High-contrast serif with soul; italic accent words sing.",
	},
	{
		id: "zodiak-general",
		name: "Zodiak & General",
		display: "Zodiak",
		body: "General Sans",
		source: "fontshare",
		arabicDisplay: "El Messiri",
		arabicBody: "IBM Plex Sans Arabic",
		mood: ["refined", "warm", "classical"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Softer serif alternative when Fraunces feels overused.",
	},
	{
		id: "tanker-general",
		name: "Tanker & General",
		display: "Tanker",
		body: "General Sans",
		source: "fontshare",
		arabicDisplay: "Rakkas",
		arabicBody: "Almarai",
		mood: ["loud", "poster", "street"],
		energy: "loud",
		priceFeel: "accessible",
		avoidFor: ["medical", "finance"],
		note: "One-weight display slab that hits like a stamp.",
	},
	{
		id: "gambetta-supreme",
		name: "Gambetta & Supreme",
		display: "Gambetta",
		body: "Supreme",
		source: "fontshare",
		arabicDisplay: "Aref Ruqaa",
		arabicBody: "Noto Naskh Arabic",
		mood: ["literary", "artisan", "quiet"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Bookish elegance for crafted goods and slow brands.",
	},
	{
		id: "bricolage-figtree",
		name: "Bricolage & Figtree",
		display: "Bricolage Grotesque",
		body: "Figtree",
		source: "google",
		arabicDisplay: "Marhey",
		arabicBody: "Rubik",
		mood: ["quirky", "friendly", "human"],
		energy: "medium",
		priceFeel: "accessible",
		note: "Charm without childishness — great for local brands.",
	},
	{
		id: "boska-switzer",
		name: "Boska & Switzer",
		display: "Boska",
		body: "Switzer",
		source: "fontshare",
		arabicDisplay: "Amiri",
		arabicBody: "IBM Plex Sans Arabic",
		mood: ["fashion", "sharp", "dramatic"],
		energy: "medium",
		priceFeel: "premium",
		note: "Fashion-magazine serif with claws.",
	},
	{
		id: "unbounded-manrope",
		name: "Unbounded & Manrope",
		display: "Unbounded",
		body: "Manrope",
		source: "google",
		arabicDisplay: "Reem Kufi",
		arabicBody: "Readex Pro",
		mood: ["futuristic", "round", "techy"],
		energy: "loud",
		priceFeel: "premium",
		note: "Expanded futuristic display — gadgets and bold tech.",
	},
	{
		id: "marcellus-karla",
		name: "Marcellus & Karla",
		display: "Marcellus",
		body: "Karla",
		source: "google",
		arabicDisplay: "El Messiri",
		arabicBody: "Tajawal",
		mood: ["calm", "classical", "dignified"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Roman-inscription calm; ages beautifully.",
	},
	{
		id: "dmserif-work",
		name: "DM Serif & Work",
		display: "DM Serif Display",
		body: "Work Sans",
		source: "google",
		arabicDisplay: "Lalezar",
		arabicBody: "Cairo",
		mood: ["editorial", "accessible", "direct"],
		energy: "medium",
		priceFeel: "accessible",
		note: "Editorial look at zero pretension — good for COD retail.",
	},
	{
		id: "chillax-synonym",
		name: "Chillax & Synonym",
		display: "Chillax",
		body: "Synonym",
		source: "fontshare",
		arabicDisplay: "Changa",
		arabicBody: "Almarai",
		mood: ["soft", "contemporary", "easy"],
		energy: "quiet",
		priceFeel: "accessible",
		note: "Rounded softness for wellness and baby brands.",
	},
	{
		id: "librecaslon-jost",
		name: "Libre Caslon & Jost",
		display: "Libre Caslon Text",
		body: "Jost",
		source: "google",
		arabicDisplay: "Amiri",
		arabicBody: "Readex Pro",
		mood: ["heritage", "trustworthy", "established"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Old-world credibility with geometric support.",
	},
	{
		id: "archivo-lora",
		name: "Archivo & Lora",
		display: "Archivo (Expanded, 800+)",
		body: "Lora",
		source: "google",
		arabicDisplay: "Cairo Play",
		arabicBody: "Noto Naskh Arabic",
		mood: ["poster", "bold", "editorial"],
		energy: "loud",
		priceFeel: "accessible",
		note: "Expanded poster caps against a bookish serif — tension that works.",
	},
	{
		id: "cabinet-erode",
		name: "Cabinet & Erode",
		display: "Cabinet Grotesk",
		body: "Erode",
		source: "fontshare",
		arabicDisplay: "Reem Kufi",
		arabicBody: "IBM Plex Sans Arabic",
		mood: ["contemporary", "design-led", "urbane"],
		energy: "medium",
		priceFeel: "premium",
		note: 'Studio-grade pairing; reads "designed" instantly.',
	},
	{
		id: "youngserif-outfit",
		name: "Young Serif & Outfit",
		display: "Young Serif",
		body: "Outfit",
		source: "google",
		arabicDisplay: "Marhey",
		arabicBody: "Rubik",
		mood: ["warm", "chunky", "appetizing"],
		energy: "medium",
		priceFeel: "accessible",
		note: "Chunky warm serif — bakeries, kitchens, comfort goods.",
	},
	{
		id: "anton-mulish",
		name: "Anton & Mulish",
		display: "Anton",
		body: "Mulish",
		source: "google",
		arabicDisplay: "Lalezar",
		arabicBody: "Cairo",
		mood: ["impact", "sport", "urgent"],
		energy: "loud",
		priceFeel: "accessible",
		avoidFor: ["luxury-quiet"],
		note: "Compressed impact for sport, promo, urgency.",
	},
	{
		id: "sentient-supreme",
		name: "Sentient & Supreme",
		display: "Sentient",
		body: "Supreme",
		source: "fontshare",
		arabicDisplay: "Amiri",
		arabicBody: "Readex Pro",
		mood: ["humanist", "literary", "gentle"],
		energy: "quiet",
		priceFeel: "premium",
		note: "A serif that breathes — essays, ateliers, slow goods.",
	},
	{
		id: "melodrama-switzer",
		name: "Melodrama & Switzer",
		display: "Melodrama",
		body: "Switzer",
		source: "fontshare",
		arabicDisplay: "Aref Ruqaa",
		arabicBody: "IBM Plex Sans Arabic",
		mood: ["dramatic", "fashion", "flamboyant"],
		energy: "loud",
		priceFeel: "premium",
		avoidFor: ["medical", "finance"],
		note: "High-drama display — fashion weeks and bold beauty.",
	},
	{
		id: "khand-mulish",
		name: "Khand & Mulish",
		display: "Khand",
		body: "Mulish",
		source: "google",
		arabicDisplay: "Changa",
		arabicBody: "Almarai",
		mood: ["condensed", "athletic", "fast"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["sport", "fitness", "delivery"],
		note: "Condensed speed without Anton's bluntness.",
	},
	{
		id: "stardom-general",
		name: "Stardom & General",
		display: "Stardom",
		body: "General Sans",
		source: "fontshare",
		arabicDisplay: "El Messiri",
		arabicBody: "Tajawal",
		mood: ["glamorous", "retro", "confident"],
		energy: "medium",
		priceFeel: "premium",
		note: "Retro-glam display with modern support — salons, events.",
	},
	{
		id: "bespoke-jost",
		name: "Bespoke Serif & Jost",
		display: "Bespoke Serif",
		body: "Jost",
		source: "mixed",
		arabicDisplay: "Amiri",
		arabicBody: "Readex Pro",
		mood: ["tailored", "trustworthy", "precise"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Quietly expensive — consulting, law, finance.",
	},
	{
		id: "nippo-synonym",
		name: "Nippo & Synonym",
		display: "Nippo",
		body: "Synonym",
		source: "fontshare",
		arabicDisplay: "Reem Kufi",
		arabicBody: "IBM Plex Sans Arabic",
		mood: ["technical", "minimal", "engineered"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["gadgets", "tech"],
		note: "Spec-sheet cool — products with engineering pride.",
	},
	{
		id: "recia-karla",
		name: "Recia & Karla",
		display: "Recia",
		body: "Karla",
		source: "mixed",
		arabicDisplay: "Amiri",
		arabicBody: "Tajawal",
		mood: ["warm", "bookish", "honest"],
		energy: "quiet",
		priceFeel: "accessible",
		note: "A friendly serif with real character — family businesses.",
	},
	{
		id: "quilon-outfit",
		name: "Quilon & Outfit",
		display: "Quilon",
		body: "Outfit",
		source: "mixed",
		arabicDisplay: "El Messiri",
		arabicBody: "Rubik",
		mood: ["crisp", "contemporary", "refined"],
		energy: "medium",
		priceFeel: "premium",
		note: "Sharp modern serif against a clean geometric sans.",
	},
	{
		id: "sora-lora",
		name: "Sora & Lora",
		display: "Sora",
		body: "Lora",
		source: "google",
		arabicDisplay: "Reem Kufi",
		arabicBody: "Noto Naskh Arabic",
		mood: ["techy", "thoughtful", "hybrid"],
		energy: "medium",
		priceFeel: "premium",
		note: "Geometric tech display over a bookish serif body — useful tension.",
	},
	{
		id: "playfair-jakarta",
		name: "Playfair & Jakarta",
		display: "Playfair Display",
		body: "Plus Jakarta Sans",
		source: "google",
		arabicDisplay: "Amiri",
		arabicBody: "Cairo",
		mood: ["classic", "familiar", "elegant"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Deliberately familiar elegance — use when comfort sells (weddings, hotels); skip when originality is the brief.",
	},
	{
		id: "syne-karla",
		name: "Syne & Karla",
		display: "Syne (700-800)",
		body: "Karla",
		source: "google",
		arabicDisplay: "Marhey",
		arabicBody: "Rubik",
		mood: ["arty", "unconventional", "studio"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["agencies", "studios", "culture"],
		note: "Design-scene favorite — great for creatives, rationed elsewhere.",
	},
	{
		id: "besley-work",
		name: "Besley & Work",
		display: "Besley (800)",
		body: "Work Sans",
		source: "google",
		arabicDisplay: "Lalezar",
		arabicBody: "Almarai",
		mood: ["sturdy", "retail", "dependable"],
		energy: "medium",
		priceFeel: "accessible",
		note: "Clarendon muscle — hardware, tools, honest retail.",
	},
];

// ─────────────────────────────────────── PAGE SKELETONS (10)
// The cure for "every page has the same sections in the same order."
// Flows are archetype-neutral: read 'order block' / 'order' as THE CONVERSION OBJECT of the
// brief's PAGE GOAL — a COD form for products, a lead/inquiry form for services & property,
// a contact moment for portfolios, a booking/registration for local businesses & events.
// Likewise 'product' beats mean "the thing being shown": a service, a property, a body of work.

export const skeletons: Skeleton[] = [
	{
		id: "split-editorial",
		name: "Split Editorial",
		hero: "Asymmetric split: oversized headline + offer left, tall masked product frame right",
		flow: [
			"proof strip",
			"story section",
			"detail trio",
			"lifestyle full-bleed",
			"order block",
			"FAQ",
		],
		mood: ["editorial", "balanced"],
		energy: "medium",
		priceFeel: "premium",
		note: "Reliable premium default — but never two runs in a row.",
	},
	{
		id: "product-stage",
		name: "Product Stage",
		hero: "Product art centered on a dramatic staged backdrop, copy beneath",
		flow: [
			"feature marquee",
			"macro details",
			"specs placard",
			"reviews",
			"order block",
		],
		mood: ["dramatic", "product-first"],
		energy: "medium",
		priceFeel: "premium",
		avoidFor: [],
		note: "The model FAVORS this one — offer it only when the product art truly carries a page.",
	},
	{
		id: "manifesto-type",
		name: "Manifesto Type",
		hero: "No product in hero: a huge typographic statement, product enters on scroll",
		flow: ["statement", "reveal product", "proof", "details", "order"],
		mood: ["bold", "brand-led", "confident"],
		energy: "loud",
		priceFeel: "premium",
		note: "For brands with a point of view; headline must be worth the size.",
	},
	{
		id: "bazar-dense",
		name: "Bazar Dense",
		hero: "Dense bento of product tiles, prices visible immediately, one oversized cell",
		flow: ["bento grid", "bestseller spotlight", "trust strip", "order block"],
		mood: ["abundant", "energetic", "market"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["multi-product", "grocery", "accessories"],
		note: "Souk energy, organized — for catalogs, not single heroes.",
	},
	{
		id: "magazine-asym",
		name: "Magazine Asymmetric",
		hero: "Overlapping editorial collage: image blocks at different scales, fig. captions",
		flow: [
			"collage hero",
			"numbered features",
			"pull-quote interlude",
			"gallery",
			"order",
		],
		mood: ["artistic", "layered", "cultured"],
		energy: "medium",
		priceFeel: "premium",
		note: "Breaks the grid on purpose; needs discipline in spacing.",
	},
	{
		id: "plein-ecran",
		name: "Plein Écran",
		hero: "Full-bleed atmosphere (CSS scene/gradient) with scrim + minimal type",
		flow: [
			"immersive hero",
			"benefit beats",
			"product close-up",
			"social proof",
			"order",
		],
		mood: ["immersive", "cinematic"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Atmosphere-first; the CSS scene must be genuinely beautiful.",
	},
	{
		id: "diagonale",
		name: "Diagonale",
		hero: "Diagonal flow: clipped section edges, rotated accents, content on a slant",
		flow: ["slanted hero", "zigzag feature rows", "stat band", "order"],
		mood: ["dynamic", "sporty", "restless"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["sport", "energy", "youth"],
		note: "Motion built into geometry; keep type strictly horizontal.",
	},
	{
		id: "bande-promo",
		name: "Bande Promo",
		hero: "Ticker-driven: marquee strips of offer/product frame a tight center hero",
		flow: ["ticker hero", "offer stack", "countdown block", "order", "FAQ"],
		mood: ["urgent", "promo", "loud"],
		energy: "loud",
		priceFeel: "accessible",
		industries: ["drops", "promos", "seasonal"],
		avoidFor: ["luxury-quiet"],
		note: "Honest urgency as design, not as red banner spam.",
	},
	{
		id: "recit-scroll",
		name: "Récit Scroll",
		hero: "Story cold-open: the problem, told big; product appears as the answer mid-page",
		flow: [
			"problem",
			"turn",
			"product reveal",
			"how it works",
			"proof",
			"order",
		],
		mood: ["narrative", "persuasive"],
		energy: "medium",
		priceFeel: "accessible",
		note: "Classic direct-response arc dressed in editorial clothes.",
	},
	{
		id: "vitrine-placard",
		name: "Vitrine Placard",
		hero: "Museum vitrine: one product per viewport, placard-style caption, extreme whitespace",
		flow: ["vitrine 1", "vitrine 2", "materials placard", "order"],
		mood: ["minimal", "gallery", "reverent"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["jewelry", "perfume", "design-objects"],
		note: "Silence as luxury; every pixel must earn its stillness.",
	},
	{
		id: "catalogue-editorial",
		name: "Catalogue Éditorial",
		hero: "An indexed list as hero: numbered rows (works, dishes, properties) that preview on hover/tap",
		flow: [
			"index hero",
			"featured entry spotlight",
			"about the maker",
			"conversion block",
		],
		mood: ["curated", "editorial", "confident"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["portfolio", "restaurant-menu", "listings"],
		note: "The list IS the design — for bodies of work, not single heroes.",
	},
	{
		id: "temoignage-ouverture",
		name: "Témoignage en Ouverture",
		hero: "Opens on the strongest result or client quote set huge, before showing what is sold",
		flow: [
			"proof hero",
			"what we do",
			"how it works",
			"more proof",
			"conversion block",
		],
		mood: ["persuasive", "credible"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["services", "coaching", "agencies"],
		note: "Leads with the outcome — only when the brief contains REAL proof.",
	},
	{
		id: "comparatif",
		name: "Comparatif",
		hero: "Product hero with a designed us-vs-ordinary comparison as the page centerpiece",
		flow: [
			"hero",
			"comparison table (designed, not a grid)",
			"details",
			"reviews",
			"conversion block",
		],
		mood: ["argumentative", "clear"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["gadgets", "supplements", "appliances"],
		note: "For products whose edge is measurable; the table must be beautiful.",
	},
	{
		id: "scene-animee",
		name: "Scène Animée",
		hero: "A generative CSS scene as hero (layered gradients, drifting shapes, grain) with type floating in it",
		flow: [
			"animated scene hero",
			"benefit beats",
			"showcase",
			"conversion block",
		],
		mood: ["otherworldly", "creative", "digital"],
		energy: "loud",
		priceFeel: "premium",
		industries: ["agencies", "tech", "events"],
		note: "Code-as-art energy without WebGL; the scene must be genuinely beautiful, not busy.",
	},
	{
		id: "processus",
		name: "Processus",
		hero: "Compact hero, then the journey as the spine: numbered steps (01→04) each with a full beat",
		flow: ["compact hero", "step 01-04 sections", "proof", "conversion block"],
		mood: ["methodical", "reassuring"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["services", "booking", "medical"],
		note: "For offers where HOW it works sells — clarity as design.",
	},
	{
		id: "longform-advertorial",
		name: "Longform Éditorial",
		hero: "Magazine-article opening: kicker, big headline, byline-style meta, then story sections",
		flow: [
			"article opening",
			"the problem, told well",
			"the discovery",
			"evidence",
			"offer reveal",
			"conversion block",
			"FAQ",
		],
		mood: ["narrative", "educational", "deep"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["supplements", "skincare", "education"],
		note: "Reads like journalism, sells like direct response; needs strong copy discipline.",
	},
];

// ─────────────────────────── SIGNATURE INTERACTIONS (13)
// All buildable with vanilla JS + CSS in one file (no CDN).

export const signatureInteractions: SignatureInteraction[] = [
	{
		id: "colorway-flip",
		name: "Colorway Flip",
		behavior:
			"A variant toggle that crossfades the product art AND re-themes the whole page surface (background, nav, buttons) in ~700ms.",
		mood: ["premium", "delightful"],
		energy: "medium",
		priceFeel: "premium",
	},
	{
		id: "price-builder",
		name: "Live Price Builder",
		behavior:
			"Quantity/bundle choices update a sticky total in real time with a satisfying count animation; the order form inherits the selection.",
		mood: ["transactional", "clear"],
		energy: "medium",
		priceFeel: "accessible",
	},
	{
		id: "order-dock",
		name: "Sticky Order Dock",
		behavior:
			"A docked COD bar (mobile-first) showing price + CTA that gains a wilaya selector and delivery ETA as the user scrolls into the order section.",
		mood: ["conversion", "pragmatic"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["cod-retail"],
	},
	{
		id: "wilaya-map",
		name: "Wilaya Delivery Selector",
		behavior:
			"Choosing the wilaya (stylized select or SVG map) live-updates delivery fee and ETA inside the order form — delivery becomes a designed moment.",
		mood: ["local", "trustworthy"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["cod-retail"],
	},
	{
		id: "before-after",
		name: "Before / After Drag",
		behavior:
			"A draggable divider wipes between before and after states of the product result.",
		mood: ["proof", "tactile"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["beauty", "cleaning", "fitness"],
	},
	{
		id: "exploded-view",
		name: "Scroll Exploded View",
		behavior:
			"Scrolling disassembles the product (layered SVG/CSS parts drift apart with labels) then reassembles it at the order section.",
		mood: ["technical", "impressive"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["gadgets", "appliances"],
	},
	{
		id: "whatsapp-concierge",
		name: "WhatsApp Concierge",
		behavior:
			'A brand-styled floating WhatsApp bubble whose pre-filled message changes with the section in view ("I want the 2-pack…").',
		mood: ["personal", "local"],
		energy: "quiet",
		priceFeel: "accessible",
	},
	{
		id: "countdown-drop",
		name: "Integrated Countdown",
		behavior:
			"An offer countdown designed INTO the hero typography (big tabular numerals, elegant), not a red banner strapped on top.",
		mood: ["urgent", "honest"],
		energy: "loud",
		priceFeel: "accessible",
		avoidFor: ["luxury-quiet"],
	},
	{
		id: "swatch-swap",
		name: "Swatch Swap",
		behavior:
			"Variant swatches (scent, flavor, size) swap the hero art, accent color and copy details together.",
		mood: ["playful", "product-rich"],
		energy: "medium",
		priceFeel: "accessible",
	},
	{
		id: "drag-gallery",
		name: "Drag Gallery",
		behavior:
			"A horizontally draggable gallery strip with inertia and edge glow; keyboard and touch friendly.",
		mood: ["tactile", "browsy"],
		energy: "medium",
		priceFeel: "premium",
	},
	{
		id: "reveal-texture",
		name: "Texture Reveal",
		behavior:
			"Hover/touch wipes away a surface layer to reveal a macro material texture beneath (CSS mask following the pointer).",
		mood: ["sensory", "crafted"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["textiles", "food", "cosmetics"],
	},
	{
		id: "fit-quiz",
		name: "3-Tap Fit Quiz",
		behavior:
			"Three quick questions recommend a variant/bundle and pre-fill the order form with it.",
		mood: ["guided", "smart"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["skincare", "supplements", "sizes"],
	},
	{
		id: "ingredient-scrub",
		name: "Ingredient Scrub",
		behavior:
			"Scroll scrubs through the product's ingredients/components one by one, each getting a full-attention beat.",
		mood: ["transparent", "educational"],
		energy: "quiet",
		priceFeel: "premium",
		industries: ["food", "cosmetics", "supplements"],
	},
	{
		id: "bundle-slider",
		name: "Bundle Slider",
		behavior:
			"A designed slider (1x / 2x / 3x / family pack) morphs the price, the savings badge and the product illustration together.",
		mood: ["transactional", "playful"],
		energy: "medium",
		priceFeel: "accessible",
		industries: ["consumables", "food", "supplements"],
	},
	{
		id: "live-configurator",
		name: "Live Configurator",
		behavior:
			"Options (color, size, engraving text) update a CSS/SVG product mock in real time; the order form inherits the exact configuration.",
		mood: ["premium", "personal"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["gifts", "jewelry", "custom-goods"],
	},
	{
		id: "magnetic-cta",
		name: "Magnetic CTA",
		behavior:
			"The main CTA subtly attracts the cursor (desktop) and answers submission with a ring-pulse celebration — no confetti, just presence.",
		mood: ["delightful", "tactile"],
		energy: "medium",
		priceFeel: "premium",
	},
	{
		id: "scroll-timeline",
		name: "Scroll Timeline",
		behavior:
			"An SVG path draws itself as the user scrolls, connecting the steps/milestones of the process or story.",
		mood: ["narrative", "methodical"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["services", "agencies", "education"],
	},
	{
		id: "day-night",
		name: "Day / Night Ambiance",
		behavior:
			"A sun/moon toggle shifts the whole page ambiance between daytime and nighttime scenes, showing the product living in both.",
		mood: ["atmospheric", "demonstrative"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["lighting", "home", "bedding"],
	},
	{
		id: "honest-counter",
		name: "Honest Edition Counter",
		behavior:
			"A designed counter of real stock or edition numbers (ONLY from brief facts) that fills a progress arc as units go.",
		mood: ["urgent", "honest"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["drops", "limited-editions"],
	},
];

// ─────────────────────────────────── MOTION VOCABULARIES (8)
// Buildable with CSS keyframes/transitions + IntersectionObserver — no libraries.

export const motionVocabs: MotionVocab[] = [
	{
		id: "cinematique-lente",
		name: "Cinématique lente",
		moves: [
			"masked line reveals (translateY inside overflow:hidden)",
			"slow 1.2s image scale-ins",
			"long cubic-bezier(.16,1,.3,1) easing",
			"80ms stagger",
		],
		mood: ["luxurious", "hushed"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Heavy and unhurried; nothing bounces.",
	},
	{
		id: "printanier",
		name: "Printanier",
		moves: [
			"springy scale pops with slight overshoot",
			"staggered chip entrances",
			"hover lifts with soft shadow growth",
		],
		mood: ["joyful", "friendly"],
		energy: "medium",
		priceFeel: "accessible",
		note: "Bouncy but disciplined — overshoot ≤ 4%.",
	},
	{
		id: "editorial-calme",
		name: "Éditorial calme",
		moves: [
			"simple fades with 12px rise",
			"no scale, no bounce",
			"generous 120ms stagger",
			"underline draw-ins on links",
		],
		mood: ["calm", "serious"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Motion you barely notice but would miss.",
	},
	{
		id: "cinetique-type",
		name: "Cinétique type",
		moves: [
			"infinite marquee strips (opposing directions)",
			"word-by-word headline reveals",
			"numbers that count up on view",
		],
		mood: ["energetic", "urban"],
		energy: "loud",
		priceFeel: "accessible",
		note: "Typography IS the animation.",
	},
	{
		id: "flottement",
		name: "Flottement",
		moves: [
			"breathing glow behind product (4s ease-in-out loop)",
			"slow floating drift on decor elements",
			"parallax at ±6% max",
		],
		mood: ["dreamy", "soft"],
		energy: "quiet",
		priceFeel: "premium",
		note: "Everything gently alive; nothing demands attention.",
	},
	{
		id: "brutal-sec",
		name: "Brutal sec",
		moves: [
			"instant state snaps (0ms or 120ms max)",
			"hard cuts between sections",
			"block color flood-fills on hover",
		],
		mood: ["raw", "confident"],
		energy: "loud",
		priceFeel: "accessible",
		note: "The absence of easing as a statement.",
	},
	{
		id: "parallaxe-couches",
		name: "Parallaxe couches",
		moves: [
			"2-3 depth layers moving at different scroll speeds",
			"foreground decor overlapping section boundaries",
		],
		mood: ["deep", "immersive"],
		energy: "medium",
		priceFeel: "premium",
		note: "Depth without WebGL; keep layers ≤3.",
	},
	{
		id: "artisanal-doux",
		name: "Artisanal doux",
		moves: [
			"grain texture overlay",
			"soft shadow shifts on hover",
			"slightly irregular hand-drawn SVG dividers animating in",
		],
		mood: ["handmade", "warm"],
		energy: "quiet",
		priceFeel: "accessible",
		note: "Imperfection as warmth, applied consistently.",
	},
	{
		id: "rideau",
		name: "Rideau",
		moves: [
			"clip-path curtain transitions between sections",
			"content revealed by the wipe rather than fading in",
			"sharp 500ms cubic-bezier(.7,0,.3,1) easing",
		],
		mood: ["theatrical", "decisive"],
		energy: "medium",
		priceFeel: "premium",
		note: "Sections change like stage sets; use ≤3 wipes per page.",
	},
	{
		id: "ondulation",
		name: "Ondulation",
		moves: [
			"organic SVG blob shapes slowly morphing (CSS keyframed border-radius)",
			"wave dividers gently shifting",
			"floating elements at different phases",
		],
		mood: ["organic", "liquid", "soft"],
		energy: "quiet",
		priceFeel: "accessible",
		industries: ["cosmetics", "wellness", "baby"],
		note: "Everything slightly liquid; amplitude tiny, period long.",
	},
	{
		id: "glissement",
		name: "Glissement",
		moves: [
			"sections enter with alternating directional slides (left/right)",
			"images slide against their frames (counter-motion)",
			"snappy 350ms exits",
		],
		mood: ["dynamic", "retail", "lively"],
		energy: "medium",
		priceFeel: "accessible",
		note: "Directional energy without bounce — alternation is the rhythm.",
	},
	{
		id: "magnetique",
		name: "Magnétique",
		moves: [
			"cursor-aware micro-attractions on CTAs and cards (desktop only)",
			"a custom cursor dot that grows over interactive elements",
			"touch devices get the tactile equivalents (press scales)",
		],
		mood: ["interactive", "studio", "premium"],
		energy: "medium",
		priceFeel: "premium",
		industries: ["agencies", "portfolios", "tech"],
		note: "The page notices you — restraint keeps it classy.",
	},
];

// ──────────────────────────────────────────── SAMPLER

export interface Candidates {
	palettes: Palette[];
	fontPairings: FontPairing[];
	skeletons: Skeleton[];
	interactions: SignatureInteraction[];
	motions: MotionVocab[];
}

export interface SampleOpts {
	/** free-text business descriptor, e.g. "candles", "streetwear" — matched against avoidFor/industries */
	business: string;
	/** ids to exclude (recently served to similar businesses — future cooldown table; unused today) */
	cooldownIds?: Set<string>;
	rng?: () => number; // inject for testability; defaults to Math.random
}

function pick<T extends Tagged>(pool: T[], n: number, opts: SampleOpts): T[] {
	const rng = opts.rng ?? Math.random;
	const eligible = pool.filter(
		(e) =>
			!opts.cooldownIds?.has(e.id) &&
			!(e.avoidFor ?? []).some((a) => opts.business.toLowerCase().includes(a)),
	);
	// Fisher–Yates partial shuffle. The undefined guard only satisfies
	// noUncheckedIndexedAccess — both indices are always in range.
	const arr = [...eligible];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const a = arr[i];
		const b = arr[j];
		if (a !== undefined && b !== undefined) {
			arr[i] = b;
			arr[j] = a;
		}
	}
	return arr.slice(0, n);
}

/** Server-side sampling — THE anti-convergence mechanism. Randomness lives here, never in the model. */
export function sampleCandidates(opts: SampleOpts): Candidates {
	return {
		palettes: pick(palettes, 5, opts),
		fontPairings: pick(fontPairings, 5, opts),
		skeletons: pick(skeletons, 4, opts),
		interactions: pick(signatureInteractions, 5, opts),
		motions: pick(motionVocabs, 4, opts),
	};
}

/** Render sampled candidates as compact text for the get_direction_candidates tool result. */
export function formatCandidates(c: Candidates): string {
	const pal = c.palettes
		.map(
			(p) =>
				`- ${p.name} [${p.id}]: bg ${p.roles.bg} · surface ${p.roles.surface} · ink ${p.roles.ink} · accent ${p.roles.accent}${p.roles.accent2 ? ` · accent2 ${p.roles.accent2}` : ""} — ${p.note} (${p.mood.join(", ")})`,
		)
		.join("\n");
	const fp = c.fontPairings
		.map(
			(f) =>
				`- ${f.name} [${f.id}]: ${f.display} + ${f.body} (${f.source}) · Arabic: ${f.arabicDisplay} + ${f.arabicBody} — ${f.note}`,
		)
		.join("\n");
	const sk = c.skeletons
		.map(
			(s) =>
				`- ${s.name} [${s.id}]: hero = ${s.hero}; flow = ${s.flow.join(" → ")} — ${s.note}`,
		)
		.join("\n");
	const si = c.interactions
		.map((i) => `- ${i.name} [${i.id}]: ${i.behavior}`)
		.join("\n");
	const mv = c.motions
		.map((m) => `- ${m.name} [${m.id}]: ${m.moves.join("; ")} — ${m.note}`)
		.join("\n");
	return `PALETTES (choose one, may fine-tune ±10% lightness):\n${pal}\n\nFONT PAIRINGS (choose one):\n${fp}\n\nPAGE SKELETONS (choose one, adapt the flow to the offer):\n${sk}\n\nSIGNATURE INTERACTIONS (choose exactly one):\n${si}\n\nMOTION VOCABULARIES (choose one):\n${mv}`;
}
