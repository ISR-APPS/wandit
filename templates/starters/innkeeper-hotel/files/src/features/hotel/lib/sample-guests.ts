// The sample guests of the hotel: 150 fictional people. It stands in for a `guests` table.
// sample-reservations.ts gives each reservation one guest id. The guests pages read `listGuests`.
// Every name is invented. Every phone number is in a range that the country keeps for fiction.
import { addDays, startOfLocalDay, toIsoDay } from "./hotel-day";
import {
	createSeededRandom,
	pickOne,
	randomInt,
	shuffled,
} from "./seeded-random";

/** One guest as the pages read it. */
export type Guest = {
	id: string;
	fullName: string;
	/** An address on example.com, a domain that is kept for documentation. */
	email: string;
	phone: string;
	city: string;
	/** ISO 3166 code of the home country, for example "FR". The pages show its name with Intl.DisplayNames. */
	countryCode: string;
	/** Day of the first stay before the sample book, `YYYY-MM-DD`. null for a guest with no earlier stay. */
	guestSince: string | null;
	/** Count of stays before the first reservation of the sample book. */
	earlierStays: number;
	/** Sum that the guest paid for those earlier stays, in whole units of HOTEL_CURRENCY. */
	earlierSpend: number;
	/** What the desk remembers about the guest, or null. */
	preference: string | null;
};

/** The names and the phone format of one country. Each first name and each last name is used one time. */
type CountryNames = {
	countryCode: string;
	cities: readonly [string, ...string[]];
	/** One first name per guest of the country. */
	firstNames: readonly string[];
	/** One last name per guest of the country. The build pairs them with the first names in a random order. */
	lastNames: readonly string[];
	/** Builds a phone number from 4 digits. The range is one that the country keeps for fiction. */
	phone: (digits: string) => string;
};

const COUNTRIES: CountryNames[] = [
	{
		countryCode: "FR",
		cities: ["Lyon", "Nantes", "Bordeaux", "Lille", "Annecy", "Rennes"],
		firstNames: [
			"Camille",
			"Hugo",
			"Élodie",
			"Bastien",
			"Margaux",
			"Aurélien",
			"Clémence",
			"Rémi",
			"Solène",
			"Thibault",
			"Apolline",
			"Gaspard",
			"Océane",
			"Lucien",
			"Maëlys",
			"Corentin",
			"Capucine",
			"Florian",
			"Agathe",
			"Quentin",
			"Héloïse",
			"Mathis",
			"Noémie",
			"Adrien",
			"Lison",
			"Timothée",
			"Garance",
			"Baptiste",
			"Salomé",
			"Victor",
			"Maxence",
			"Louise",
			"Arthur",
			"Jeanne",
			"Raphaël",
			"Anaïs",
			"Sylvain",
			"Mathilde",
			"Julien",
			"Élise",
			"Cyprien",
			"Romane",
			"Valentin",
			"Ophélie",
			"Germain",
			"Blanche",
			"Léandre",
			"Suzanne",
			"Arnaud",
			"Victoire",
		],
		lastNames: [
			"Verdier",
			"Lambert",
			"Marchetti",
			"Fontaine",
			"Besson",
			"Charpentier",
			"Rousselot",
			"Delmas",
			"Aubry",
			"Perrault",
			"Tessier",
			"Collinet",
			"Vasseur",
			"Monnier",
			"Gaillard",
			"Lacombe",
			"Roussel",
			"Chevrier",
			"Barthélemy",
			"Duval",
			"Morin",
			"Leclerc",
			"Girard",
			"Renaud",
			"Picard",
			"Mercier",
			"Jourdan",
			"Blanchet",
			"Carpentier",
			"Hamel",
			"Lefèvre",
			"Bonnet",
			"Masson",
			"Chabert",
			"Vidal",
			"Marchand",
			"Brunet",
			"Fabre",
			"Guérin",
			"Lemoine",
			"Baudry",
			"Sauvage",
			"Clément",
			"Poirier",
			"Rivière",
			"Tissier",
			"Delorme",
			"Pasquier",
			"Bouvier",
			"Maillard",
		],
		phone: (digits) => `+33 6 39 98 ${digits.slice(0, 2)} ${digits.slice(2)}`,
	},
	{
		countryCode: "GB",
		cities: ["London", "Bristol", "Edinburgh", "Leeds", "Bath"],
		firstNames: [
			"Harriet",
			"Callum",
			"Imogen",
			"Rupert",
			"Freya",
			"Alistair",
			"Poppy",
			"Duncan",
			"Tamsin",
			"Elliot",
			"Beatrice",
			"Hamish",
			"Rosalind",
			"Jasper",
			"Cordelia",
			"Fergus",
			"Philippa",
			"Barnaby",
			"Arabella",
			"Gideon",
			"Henrietta",
			"Rowan",
			"Flora",
			"Crispin",
			"Ottilie",
			"Magnus",
			"Clementine",
			"Ambrose",
			"Verity",
			"Tobias",
		],
		lastNames: [
			"Ashdown",
			"Pemberton",
			"Whitlock",
			"Hargreave",
			"Calloway",
			"Fenwick",
			"Thorne",
			"Lockhart",
			"Mayhew",
			"Stroud",
			"Winterbourne",
			"Radcliffe",
			"Holloway",
			"Marchbanks",
			"Ellery",
			"Kingsley",
			"Aldridge",
			"Summerfield",
			"Blackwood",
			"Carrington",
			"Fairchild",
			"Greaves",
			"Hawthorne",
			"Ingram",
			"Latimer",
			"Merriweather",
			"Oakley",
			"Penhallow",
			"Sedgwick",
			"Tennant",
		],
		phone: (digits) => `+44 7700 900${digits.slice(1)}`,
	},
	{
		countryCode: "US",
		cities: ["Boston", "Chicago", "Portland", "Austin", "Denver"],
		firstNames: [
			"Nora",
			"Wesley",
			"Maya",
			"Grant",
			"Delia",
			"Marcus",
			"Josie",
			"Theo",
			"Lena",
			"Caleb",
			"Paige",
			"Desmond",
			"Willa",
			"Jonah",
			"Hazel",
			"Elias",
			"Ruby",
			"Silas",
			"Margot",
			"Dean",
			"Iris",
			"Reid",
			"Tessa",
			"Malcolm",
			"June",
			"Emmett",
		],
		lastNames: [
			"Hollis",
			"Brennan",
			"Okafor",
			"Whitaker",
			"Sandoval",
			"Lindqvist",
			"Marlow",
			"Abernathy",
			"Castellan",
			"Rhodes",
			"Nakamura",
			"Delgado",
			"Prescott",
			"Vandermeer",
			"Calder",
			"Ashby",
			"Thornton",
			"Mercer",
			"Beckett",
			"Langford",
			"Sutton",
			"Winslow",
			"Hadley",
			"Rourke",
			"Ellison",
			"Monroe",
		],
		phone: (digits) => `+1 617 555 01${digits.slice(2)}`,
	},
	{
		countryCode: "DE",
		cities: ["Hamburg", "Munich", "Cologne", "Leipzig"],
		firstNames: [
			"Jonas",
			"Leonie",
			"Matthias",
			"Greta",
			"Felix",
			"Annika",
			"Moritz",
			"Carla",
			"Henrik",
			"Frieda",
			"Lukas",
			"Marlene",
			"Benedikt",
			"Ida",
			"Konrad",
			"Paula",
			"Emil",
			"Johanna",
		],
		lastNames: [
			"Brandt",
			"Hoffmeister",
			"Weidner",
			"Kessler",
			"Lindner",
			"Albrecht",
			"Vogt",
			"Sommer",
			"Rautenberg",
			"Engelhardt",
			"Falkner",
			"Steinbach",
			"Winkler",
			"Lorenz",
			"Bergmann",
			"Hartwig",
			"Neuhaus",
			"Thalberg",
		],
		phone: (digits) => `+49 30 23125 ${digits.slice(1)}`,
	},
	{
		countryCode: "CA",
		cities: ["Montréal", "Toronto", "Vancouver", "Québec"],
		firstNames: [
			"Maëlle",
			"Owen",
			"Juliette",
			"Tristan",
			"Naomi",
			"Étienne",
			"Sienna",
			"Gabrielle",
			"Liam",
			"Florence",
			"Xavier",
			"Madeleine",
			"Cédric",
			"Rosalie",
		],
		lastNames: [
			"Tremblay-Roy",
			"Gauthier",
			"Macallan",
			"Pelletier",
			"Beaulac",
			"Sinclair",
			"Lévesque",
			"Bergeron",
			"Cloutier",
			"Fraser",
			"Lachance",
			"Mackenzie",
			"Ouellet",
			"Thibodeau",
		],
		phone: (digits) => `+1 613 555 01${digits.slice(2)}`,
	},
	{
		countryCode: "AU",
		cities: ["Melbourne", "Sydney", "Hobart"],
		firstNames: [
			"Isla",
			"Lachlan",
			"Matilda",
			"Angus",
			"Zara",
			"Harper",
			"Declan",
			"Tilly",
			"Callan",
			"Evie",
			"Mitchell",
			"Adelaide",
		],
		lastNames: [
			"Kirkwood",
			"Mallory",
			"Dunmore",
			"Hartigan",
			"Selby",
			"Whitford",
			"Barlow",
			"Kendrick",
			"Lyndon",
			"Ashcroft",
			"Farrow",
			"Pascoe",
		],
		phone: (digits) => `+61 2 5550 ${digits}`,
	},
];

const PREFERENCES = [
	"Feather-free pillows.",
	"Quiet room, away from the lift.",
	"Late check-out when the room is free.",
	"Oat milk at breakfast.",
	"Extra blanket in the wardrobe.",
	"Still water, no sparkling.",
	"Ground coffee, no capsules.",
	"Travels with a small dog.",
	"Early breakfast, before 07:00.",
	"Vegetarian menu.",
] as const;

// A fixed seed: the same 150 guests on every load.
const GUEST_SEED = 4117;

/** The fixed facts of one guest. `listGuests` adds the dates. */
type GuestSeed = Omit<Guest, "guestSince"> & {
	/** Days from the first stay to today. null for a guest with no earlier stay. */
	guestSinceDaysAgo: number | null;
};

function buildGuestSeeds(): GuestSeed[] {
	const random = createSeededRandom(GUEST_SEED);
	const people = COUNTRIES.flatMap((country) => {
		const lastNames = shuffled(random, country.lastNames);
		return country.firstNames.map((firstName, index) => {
			const fullName = `${firstName} ${lastNames[index] ?? ""}`;
			// 6 guests of 10 are new. The others stayed 1 to 9 times before.
			const earlierStays = random() < 0.6 ? 0 : randomInt(random, 1, 9);
			return {
				fullName,
				// NFD splits "é" into "e" and an accent mark. The second replace drops the marks.
				email: `${fullName
					.toLowerCase()
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.replace(" ", ".")}@example.com`,
				phone: country.phone(
					String(randomInt(random, 0, 9999)).padStart(4, "0"),
				),
				city: pickOne(random, country.cities),
				countryCode: country.countryCode,
				// A returning guest came first 2 months to 4 years ago.
				guestSinceDaysAgo:
					earlierStays > 0 ? randomInt(random, 60, 1460) : null,
				earlierStays,
				// 2 nights on average, at about 190 a night with extras.
				earlierSpend: earlierStays * randomInt(random, 300, 560),
				preference: random() < 0.4 ? pickOne(random, PREFERENCES) : null,
			};
		});
	});
	// A random order mixes the countries, so the guests of one day do not all come from one place.
	return shuffled(
		random,
		people.map((_, index) => index),
	).flatMap((personIndex, index) => {
		const person = people[personIndex];
		return person
			? [{ ...person, id: `guest-${String(index + 1).padStart(3, "0")}` }]
			: [];
	});
}

/** The 150 guest seeds, made once. sample-reservations.ts picks guests from this list. */
export const GUEST_SEEDS: GuestSeed[] = buildGuestSeeds();

/** Every guest, with `guestSince` made from `now` (milliseconds since 1970). */
export function listGuests(now: number): Guest[] {
	const todayStart = startOfLocalDay(now);
	return GUEST_SEEDS.map(({ guestSinceDaysAgo, ...seed }) => ({
		...seed,
		guestSince:
			guestSinceDaysAgo === null
				? null
				: toIsoDay(addDays(todayStart, -guestSinceDaysAgo)),
	}));
}
