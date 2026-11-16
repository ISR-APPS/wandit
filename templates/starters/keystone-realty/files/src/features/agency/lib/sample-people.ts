// The name pools of the sample people: the leads, the buyers, and the sellers.
// sample-listings.ts and sample-leads.ts build one full name from one whole number.
// Each pair of pools has lengths with no common factor, so the full names do not repeat.

// 48 first names and 53 last names: 2,544 numbers in a row give 2,544 different full names.
const FIRST_NAMES = [
	"Amara",
	"Leo",
	"Sofia",
	"Marcus",
	"Yuki",
	"Elena",
	"Tobias",
	"Nia",
	"Rafael",
	"Ingrid",
	"Omar",
	"Clara",
	"Dev",
	"Maya",
	"Felix",
	"Zara",
	"Henrik",
	"Lucia",
	"Samir",
	"Tessa",
	"Kwame",
	"Alina",
	"Jasper",
	"Mei",
	"Andre",
	"Freya",
	"Hassan",
	"Isla",
	"Mateo",
	"Noor",
	"Viktor",
	"Greta",
	"Emeka",
	"Paloma",
	"Rowan",
	"Selin",
	"Dario",
	"Anouk",
	"Idris",
	"Carys",
	"Luca",
	"Thandi",
	"Emil",
	"Rosa",
	"Kenji",
	"Livia",
	"Arjun",
	"Odette",
] as const;

const LAST_NAMES = [
	"Bennett",
	"Okonkwo",
	"Lindqvist",
	"Marchetti",
	"Tanaka",
	"Alvarez",
	"Fairbanks",
	"Nakamura",
	"Delacroix",
	"Whitaker",
	"Osei",
	"Brandt",
	"Kaplan",
	"Moreau",
	"Sandoval",
	"Hartley",
	"Ivanova",
	"Castellan",
	"Reyes",
	"Thornbury",
	"Mbeki",
	"Lachance",
	"Petrov",
	"Ashdown",
	"Kimura",
	"Valdez",
	"Nordin",
	"Farrow",
	"Okafor",
	"Bellweather",
	"Santoro",
	"Greaves",
	"Haddad",
	"Lindgren",
	"Castillo",
	"Pemberton",
	"Yilmaz",
	"Rosales",
	"Winslow",
	"Achterberg",
	"Dufresne",
	"Callow",
	"Novak",
	"Easton",
	"Mirza",
	"Holt",
	"Bianchi",
	"Stavros",
	"Quill",
	"Abernathy",
	"Jovanovic",
	"Sinclair",
	"Marlowe",
] as const;

// 29 first names and 31 last names for the buyer of each sold home. No name is in the pools above.
const BUYER_FIRST_NAMES = [
	"Beatrix",
	"Cormac",
	"Daphne",
	"Eamon",
	"Fatima",
	"Gideon",
	"Helena",
	"Ishaan",
	"Juno",
	"Kofi",
	"Lorenzo",
	"Mirela",
	"Nikolai",
	"Ottilie",
	"Pavel",
	"Quentin",
	"Renata",
	"Soren",
	"Talia",
	"Ulrich",
	"Valentina",
	"Wendell",
	"Ximena",
	"Yusuf",
	"Zelda",
	"Anselm",
	"Bronwyn",
	"Cyrus",
	"Delphine",
] as const;

const BUYER_LAST_NAMES = [
	"Aldridge",
	"Baptiste",
	"Cheng",
	"Drummond",
	"Eriksen",
	"Fontaine",
	"Galloway",
	"Hosseini",
	"Ibarra",
	"Jansen",
	"Kowalski",
	"Lombardi",
	"Mensah",
	"Nystrom",
	"Ortega",
	"Papadakis",
	"Quintero",
	"Rahman",
	"Sorensen",
	"Teller",
	"Ueda",
	"Vasquez",
	"Wexford",
	"Xu",
	"Yeboah",
	"Zielinski",
	"Arkwright",
	"Blackwood",
	"Cortez",
	"Dalgaard",
	"Egerton",
] as const;

// 29 last names for the sellers. A seller takes a first name of the first pool.
const SELLER_LAST_NAMES = [
	"Ackroyd",
	"Barlowe",
	"Carmichael",
	"Dunleavy",
	"Ellery",
	"Fitzroy",
	"Gallagher",
	"Hollis",
	"Inglewood",
	"Jessop",
	"Kendrick",
	"Lockhart",
	"Montague",
	"Northcott",
	"Oakes",
	"Prescott",
	"Radcliffe",
	"Sutherland",
	"Trevelyan",
	"Underwood",
	"Vickers",
	"Warrender",
	"Yardley",
	"Ainsley",
	"Bexley",
	"Crowther",
	"Denholm",
	"Eastwick",
	"Faulkner",
] as const;

function nameAt(names: readonly string[], index: number): string {
	return names[index % names.length] ?? "";
}

/** The full name of the lead with this sequence number. Numbers in a row give different first names. */
export function leadNameOf(sequence: number): string {
	return `${nameAt(FIRST_NAMES, sequence)} ${nameAt(LAST_NAMES, sequence)}`;
}

/** The full name of the buyer of the listing of day `listingDay`. */
export function buyerNameOf(listingDay: number): string {
	return `${nameAt(BUYER_FIRST_NAMES, listingDay)} ${nameAt(BUYER_LAST_NAMES, listingDay)}`;
}

/** The full name of the seller of the listing of day `listingDay`. */
export function sellerNameOf(listingDay: number): string {
	// 5 has no common factor with 48, so listings of days in a row get first names far apart.
	return `${nameAt(FIRST_NAMES, listingDay * 5 + 3)} ${nameAt(SELLER_LAST_NAMES, listingDay)}`;
}

/** A sample email of a person, on the reserved domain example.com. */
export function emailOf(fullName: string): string {
	return `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`;
}

/** A sample phone number in the range 555-0100 to 555-0199, which no real line uses. */
export function phoneOf(sequence: number): string {
	// 100 numbers exist in the range, so two people can share one.
	return `555-01${String(sequence % 100).padStart(2, "0")}`;
}
