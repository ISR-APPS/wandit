// The patients of the practice: sample rows that stand in for the table `patients`.
// A seeded generator builds them, so they are the same on every load. A date of birth and an older file
// count back from January 1, so they change once a year. A new file keeps its calendar day for 89 days.
// The appointment generator reads the plan fields. To make it real: read the table in a query file.
import {
	addDays,
	atMinute,
	daysBetween,
	epochDay,
	startOfLocalDay,
	toIsoDay,
} from "./clinic-day";
import { listPractitioners } from "./sample-practitioners";
import {
	createSeededRandom,
	pickOne,
	type Random,
	randomInt,
} from "./seeded-random";

/** Who pays for the care. The label is the message key `coverage.<coverage>`. */
export type Coverage = "public" | "private" | "self_pay";

/** One patient file. */
export type Patient = {
	/** Stable id, also the `$patientId` of the detail route, for example "pat-0042". */
	id: string;
	/** The number on the paper file, for example "P-10042". Staff search with it. */
	fileNumber: string;
	firstName: string;
	lastName: string;
	/** First and last name, for display. No two patients have the same one. */
	fullName: string;
	/** Date of birth as `YYYY-MM-DD`. */
	dateOfBirth: string;
	sex: "female" | "male";
	/** A fictional phone number: the 555-01xx range is reserved for examples. */
	phone: string;
	/** null when the patient gave no email. example.com is a reserved documentation domain. */
	email: string | null;
	/** Id of the practitioner who follows the patient: a general practitioner, or the pediatrician for a child. */
	primaryPractitionerId: string;
	coverage: Coverage;
	/** ABO group and rhesus sign, for example "O+". */
	bloodType: string;
	/** Known allergies, as plain names. Empty when none is on file. */
	allergies: readonly string[];
	/** Long-term conditions, as plain names. Empty when none is on file. */
	conditions: readonly string[];
	/** One sentence for the front desk, or null. */
	note: string | null;
	/** When the practice opened the file, in milliseconds since 1970. */
	registeredAt: number;
};

/** A patient with the fields that only the appointment generator reads. */
export type PatientPlan = Patient & {
	/** How often the generator books the patient: 1 plus the count of long-term conditions, so 1 to 3. */
	visitWeight: number;
	/** True for a patient in a physiotherapy program. */
	isInTherapy: boolean;
	/** True for a patient that the dermatologist follows. */
	hasSkinCare: boolean;
	/** Day offset from today of the first visit of a new patient, or null for a patient of more than 90 days. */
	firstVisitOffset: number | null;
};

/** The count of patient files of the sample practice. */
const PATIENT_COUNT = 360;
/** Files opened in the last 90 days. They feed the "new patients" figure. */
const RECENT_COUNT = 45;
// A new file is 1 to RECENT_CYCLE_DAYS days old. After that it opens again as the newest file.
const RECENT_CYCLE_DAYS = 89;
// A patient under 16 goes to the pediatrician.
const ADULT_AGE = 16;

/** First names and family names of one origin. A patient takes a first name of the group of the family name. */
type NameGroup = {
	/** First names of women and girls. */
	female: readonly string[];
	/** First names of men and boys. */
	male: readonly string[];
	/** Family names. Each one names one file, or the two files of one household. */
	lastNames: readonly string[];
};

// A mixed city practice. The groups hold 410 family names, more than the 345 that the files use.
// A first name always comes from the group of the family name, so no row pairs names of two cultures.
const NAME_GROUPS: readonly NameGroup[] = [
	// English, Irish, and Scottish names.
	{
		female: [
			"Emily",
			"Hannah",
			"Grace",
			"Olivia",
			"Abigail",
			"Megan",
			"Sarah",
			"Rachel",
			"Laura",
			"Claire",
			"Katherine",
			"Rebecca",
			"Lauren",
			"Molly",
			"Amelia",
			"Charlotte",
			"Ellen",
			"Paige",
			"Natalie",
			"Julia",
			"Caroline",
			"Heather",
			"Brooke",
			"Erin",
			"Fiona",
			"Siobhan",
			"Maeve",
			"Shannon",
			"Kelsey",
			"Ruth",
			"Margaret",
			"Susan",
			"Linda",
			"Diane",
			"Carol",
			"Janet",
			"Holly",
			"Bethany",
			"Alice",
			"Lucy",
		],
		male: [
			"James",
			"Daniel",
			"Michael",
			"Ryan",
			"Matthew",
			"Andrew",
			"Thomas",
			"William",
			"Benjamin",
			"Nathan",
			"Samuel",
			"Owen",
			"Liam",
			"Connor",
			"Patrick",
			"Sean",
			"Ethan",
			"Jacob",
			"Tyler",
			"Kevin",
			"Brian",
			"Gregory",
			"Richard",
			"Robert",
			"David",
			"Peter",
			"Graham",
			"Callum",
			"Declan",
			"Ian",
			"Gavin",
			"Harold",
			"Walter",
			"Frank",
			"Dennis",
			"George",
			"Henry",
			"Jack",
			"Oliver",
			"Mark",
		],
		lastNames: [
			"Abbott",
			"Ashworth",
			"Barlow",
			"Bennett",
			"Bishop",
			"Blake",
			"Bradley",
			"Brannigan",
			"Brennan",
			"Brooks",
			"Callahan",
			"Carver",
			"Chapman",
			"Cole",
			"Collins",
			"Connolly",
			"Cooper",
			"Crawford",
			"Cunningham",
			"Dalton",
			"Doherty",
			"Donovan",
			"Doyle",
			"Dunbar",
			"Ellison",
			"Fairbanks",
			"Fletcher",
			"Foster",
			"Gallagher",
			"Garrett",
			"Gibbs",
			"Gilmore",
			"Gordon",
			"Graves",
			"Hadley",
			"Hale",
			"Harlow",
			"Hartley",
			"Hayes",
			"Holloway",
			"Hughes",
			"Keane",
			"Kendrick",
			"Kerr",
			"Kirkland",
			"Lawson",
			"Lowell",
			"Lynch",
			"MacLeod",
			"Maddox",
			"Marsh",
			"McAllister",
			"McBride",
			"McKenna",
			"Mercer",
			"Monroe",
			"Morrow",
			"Nolan",
			"Osborne",
			"Palmer",
			"Parrish",
			"Pearson",
			"Pierce",
			"Prescott",
			"Quinn",
			"Radford",
			"Reilly",
			"Riley",
			"Rowe",
			"Sawyer",
			"Sheridan",
			"Sinclair",
			"Slater",
			"Spencer",
			"Stafford",
			"Sutton",
			"Thornton",
			"Tierney",
			"Turner",
			"Wade",
			"Walsh",
			"Warren",
			"Webb",
			"Whitaker",
			"Whitfield",
			"Winslow",
			"Wright",
			"Yates",
			"Young",
		],
	},
	// Spanish and Latin American names.
	{
		female: [
			"Lucia",
			"Valentina",
			"Camila",
			"Isabel",
			"Gabriela",
			"Daniela",
			"Mariana",
			"Paula",
			"Carmen",
			"Rosa",
			"Elena",
			"Ximena",
			"Adriana",
			"Marisol",
			"Pilar",
			"Beatriz",
			"Lorena",
			"Veronica",
			"Alejandra",
			"Natalia",
			"Luz",
			"Teresa",
			"Sofia",
			"Renata",
		],
		male: [
			"Mateo",
			"Diego",
			"Santiago",
			"Alejandro",
			"Javier",
			"Carlos",
			"Luis",
			"Andres",
			"Miguel",
			"Rafael",
			"Emilio",
			"Pablo",
			"Joaquin",
			"Hector",
			"Ramon",
			"Sergio",
			"Ricardo",
			"Tomas",
			"Felipe",
			"Esteban",
			"Marco",
			"Raul",
			"Ignacio",
			"Eduardo",
		],
		lastNames: [
			"Acosta",
			"Aguilar",
			"Alvarado",
			"Arroyo",
			"Barrios",
			"Benitez",
			"Cabrera",
			"Calderon",
			"Campos",
			"Cardenas",
			"Castillo",
			"Cervantes",
			"Cisneros",
			"Contreras",
			"Delgado",
			"Escobar",
			"Espinoza",
			"Figueroa",
			"Fuentes",
			"Galindo",
			"Guerrero",
			"Ibarra",
			"Lozano",
			"Maldonado",
			"Marquez",
			"Medina",
			"Mejia",
			"Miranda",
			"Molina",
			"Navarro",
			"Ochoa",
			"Orozco",
			"Pacheco",
			"Padilla",
			"Paredes",
			"Quintero",
			"Rios",
			"Salazar",
			"Sandoval",
			"Serrano",
			"Solis",
			"Tapia",
			"Trujillo",
			"Valdez",
			"Vargas",
			"Velasquez",
			"Villanueva",
			"Zamora",
			"Zapata",
		],
	},
	// Italian names.
	{
		female: [
			"Giulia",
			"Francesca",
			"Chiara",
			"Alessia",
			"Martina",
			"Federica",
			"Elisa",
			"Silvia",
			"Paola",
			"Serena",
			"Giorgia",
			"Bianca",
		],
		male: [
			"Luca",
			"Matteo",
			"Giovanni",
			"Alessandro",
			"Stefano",
			"Davide",
			"Paolo",
			"Enrico",
			"Riccardo",
			"Fabio",
			"Simone",
			"Lorenzo",
		],
		lastNames: [
			"Amato",
			"Barbieri",
			"Bellini",
			"Caruso",
			"Colombo",
			"Conti",
			"Esposito",
			"Fabbri",
			"Ferrara",
			"Ferri",
			"Gallo",
			"Greco",
			"Lombardi",
			"Mancini",
			"Marino",
			"Moretti",
			"Pellegrini",
			"Ricci",
			"Rinaldi",
			"Romano",
			"Santoro",
			"Testa",
			"Vitale",
		],
	},
	// German, Austrian, and Dutch names.
	{
		female: [
			"Anna",
			"Katrin",
			"Lena",
			"Johanna",
			"Miriam",
			"Sabine",
			"Greta",
			"Leonie",
			"Anke",
			"Femke",
			"Sanne",
			"Ilse",
		],
		male: [
			"Lukas",
			"Jonas",
			"Felix",
			"Matthias",
			"Stefan",
			"Tobias",
			"Jan",
			"Pieter",
			"Sebastian",
			"Florian",
			"Bram",
			"Dieter",
		],
		lastNames: [
			"Bakker",
			"Becker",
			"Brandt",
			"Dekker",
			"Fischer",
			"Hartmann",
			"Hoffmann",
			"Jansen",
			"Kessler",
			"Klein",
			"Kraus",
			"Lehmann",
			"Meier",
			"Mulder",
			"Neumann",
			"Richter",
			"Schmitt",
			"Smit",
			"Visser",
			"Vogel",
			"Weber",
			"Zimmermann",
		],
	},
	// Nordic names.
	{
		female: [
			"Ingrid",
			"Freya",
			"Astrid",
			"Sigrid",
			"Linnea",
			"Elin",
			"Maja",
			"Saga",
			"Aino",
			"Helmi",
			"Karin",
			"Tove",
		],
		male: [
			"Erik",
			"Lars",
			"Anders",
			"Magnus",
			"Nils",
			"Oskar",
			"Mikael",
			"Eino",
			"Johan",
			"Axel",
			"Rasmus",
			"Viggo",
		],
		lastNames: [
			"Aalto",
			"Bergstrom",
			"Dahl",
			"Eklund",
			"Halvorsen",
			"Hedlund",
			"Holm",
			"Jakobsen",
			"Korhonen",
			"Lehtonen",
			"Lindqvist",
			"Lund",
			"Nyberg",
			"Nygaard",
			"Sandberg",
			"Strand",
			"Virtanen",
			"Wikstrom",
		],
	},
	// French names.
	{
		female: [
			"Camille",
			"Chloe",
			"Manon",
			"Juliette",
			"Margaux",
			"Elodie",
			"Amelie",
			"Sylvie",
			"Aurelie",
			"Noemie",
		],
		male: [
			"Hugo",
			"Louis",
			"Antoine",
			"Julien",
			"Mathieu",
			"Olivier",
			"Theo",
			"Etienne",
			"Lucien",
			"Remi",
		],
		lastNames: [
			"Blanchard",
			"Bonnet",
			"Chevalier",
			"Dubois",
			"Fontaine",
			"Garnier",
			"Gauthier",
			"Girard",
			"Lambert",
			"Lefebvre",
			"Leroy",
			"Marchand",
			"Mercier",
			"Moreau",
			"Perrin",
			"Renaud",
			"Rousseau",
		],
	},
	// Polish, Czech, Ukrainian, and Balkan names.
	{
		female: [
			"Katarzyna",
			"Agnieszka",
			"Zofia",
			"Olga",
			"Irina",
			"Tatiana",
			"Daria",
			"Milena",
			"Petra",
			"Ivana",
			"Oksana",
			"Vera",
			"Alena",
			"Marta",
		],
		male: [
			"Piotr",
			"Marek",
			"Jakub",
			"Pavel",
			"Dmitri",
			"Andrei",
			"Ivan",
			"Mikhail",
			"Ondrej",
			"Luka",
			"Bogdan",
			"Viktor",
			"Nikola",
			"Stanislav",
		],
		lastNames: [
			"Babic",
			"Baran",
			"Bondarenko",
			"Dvorak",
			"Horvat",
			"Jovanovic",
			"Kaczmarek",
			"Kovac",
			"Kovalenko",
			"Kral",
			"Krawczyk",
			"Markovic",
			"Mazur",
			"Melnyk",
			"Nikolic",
			"Novak",
			"Nowak",
			"Pawlak",
			"Petrovic",
			"Shevchenko",
			"Sikora",
			"Svoboda",
			"Tkachenko",
			"Wojcik",
			"Zajac",
		],
	},
	// Greek names.
	{
		female: [
			"Eleni",
			"Katerina",
			"Despina",
			"Ioanna",
			"Dimitra",
			"Anastasia",
			"Theodora",
			"Vasiliki",
		],
		male: [
			"Nikos",
			"Giorgos",
			"Kostas",
			"Dimitris",
			"Yannis",
			"Stavros",
			"Alexandros",
			"Petros",
		],
		lastNames: [
			"Andreou",
			"Antoniou",
			"Christou",
			"Demetriou",
			"Georgiou",
			"Konstantinou",
			"Pappas",
			"Stavrou",
			"Vlachos",
		],
	},
	// Portuguese and Brazilian names.
	{
		female: [
			"Leonor",
			"Joana",
			"Raquel",
			"Fernanda",
			"Larissa",
			"Thais",
			"Catarina",
			"Rita",
		],
		male: [
			"Joao",
			"Tiago",
			"Bruno",
			"Rodrigo",
			"Gustavo",
			"Nuno",
			"Vinicius",
			"Duarte",
		],
		lastNames: [
			"Almeida",
			"Azevedo",
			"Barbosa",
			"Cardoso",
			"Correia",
			"Costa",
			"Ferreira",
			"Lopes",
			"Machado",
			"Monteiro",
			"Moura",
			"Pinheiro",
			"Ribeiro",
			"Teixeira",
		],
	},
	// West African names.
	{
		female: [
			"Adaeze",
			"Chioma",
			"Ngozi",
			"Folake",
			"Yetunde",
			"Abena",
			"Ama",
			"Efua",
			"Akosua",
			"Nneka",
			"Funmi",
			"Ifeoma",
		],
		male: [
			"Chinedu",
			"Emeka",
			"Tunde",
			"Femi",
			"Kwame",
			"Kofi",
			"Yaw",
			"Obinna",
			"Segun",
			"Olumide",
			"Kwabena",
			"Ikenna",
		],
		lastNames: [
			"Adebayo",
			"Adeleke",
			"Afolabi",
			"Agyeman",
			"Akinola",
			"Appiah",
			"Asante",
			"Boateng",
			"Darko",
			"Eze",
			"Mensah",
			"Nwosu",
			"Obi",
			"Okeke",
			"Okoro",
			"Olawale",
			"Onyeka",
			"Owusu",
			"Uzoma",
		],
	},
	// Indian names.
	{
		female: [
			"Ananya",
			"Kavya",
			"Meera",
			"Divya",
			"Sunita",
			"Neha",
			"Pooja",
			"Riya",
			"Lakshmi",
			"Shreya",
			"Anjali",
			"Deepa",
		],
		male: [
			"Arjun",
			"Rohan",
			"Vikram",
			"Aditya",
			"Rahul",
			"Sanjay",
			"Karthik",
			"Nikhil",
			"Ravi",
			"Dev",
			"Anil",
			"Suresh",
		],
		lastNames: [
			"Agarwal",
			"Bhatt",
			"Chopra",
			"Desai",
			"Gupta",
			"Iyer",
			"Joshi",
			"Kapoor",
			"Krishnan",
			"Malhotra",
			"Mehta",
			"Nair",
			"Patel",
			"Pillai",
			"Reddy",
			"Sethi",
			"Shah",
			"Srinivasan",
			"Trivedi",
			"Verma",
		],
	},
	// Pakistani and Bangladeshi names.
	{
		female: ["Farah", "Nusrat", "Sana", "Ayesha", "Hina", "Rabia"],
		male: ["Imran", "Arif", "Faisal", "Tariq", "Bilal", "Usman"],
		lastNames: [
			"Akhtar",
			"Chowdhury",
			"Hussain",
			"Iqbal",
			"Malik",
			"Qureshi",
			"Rahman",
			"Siddiqui",
		],
	},
	// Chinese names.
	{
		female: [
			"Mei",
			"Xiu",
			"Jing",
			"Yan",
			"Hui",
			"Ying",
			"Fang",
			"Lan",
			"Wen",
			"Qing",
		],
		male: [
			"Wei",
			"Jun",
			"Hao",
			"Ming",
			"Lei",
			"Tao",
			"Jian",
			"Bo",
			"Yong",
			"Feng",
		],
		lastNames: [
			"Cheng",
			"Deng",
			"Gao",
			"Guo",
			"Huang",
			"Liang",
			"Liu",
			"Luo",
			"Song",
			"Sun",
			"Tang",
			"Wu",
			"Xu",
			"Zhang",
			"Zhou",
		],
	},
	// Korean names.
	{
		female: ["Minji", "Seoyeon", "Jiwon", "Hana", "Yuna", "Soyeon"],
		male: ["Minjun", "Jihoon", "Hyunwoo", "Seojun", "Dohyun", "Taeyang"],
		lastNames: [
			"Choi",
			"Han",
			"Jung",
			"Kang",
			"Kim",
			"Kwon",
			"Park",
			"Seo",
			"Shin",
			"Yoon",
		],
	},
	// Japanese names.
	{
		female: ["Yuki", "Haruka", "Aiko", "Emi", "Sakura", "Naomi", "Rina", "Mio"],
		male: [
			"Haruto",
			"Kenji",
			"Takeshi",
			"Daisuke",
			"Ren",
			"Sota",
			"Hiroshi",
			"Kaito",
		],
		lastNames: [
			"Hayashi",
			"Ito",
			"Kobayashi",
			"Matsumoto",
			"Mori",
			"Nakamura",
			"Sato",
			"Shimizu",
			"Suzuki",
			"Tanaka",
			"Watanabe",
			"Yamamoto",
		],
	},
	// Vietnamese names.
	{
		female: ["Linh", "Mai", "Thao", "Trang", "Huong", "Ngoc"],
		male: ["Minh", "Duc", "Quang", "Tuan", "Khanh", "Bao"],
		lastNames: [
			"Bui",
			"Dang",
			"Hoang",
			"Le",
			"Ngo",
			"Nguyen",
			"Pham",
			"Tran",
			"Vu",
		],
	},
	// Filipino names.
	{
		female: ["Maricel", "Kristine", "Jasmine", "Angelica", "Rowena", "Lourdes"],
		male: ["Jericho", "Rodel", "Ramil", "Jomar", "Arnel", "Paolo"],
		lastNames: [
			"Aquino",
			"Bautista",
			"Dizon",
			"Galang",
			"Manalo",
			"Mendoza",
			"Pascual",
			"Reyes",
			"Santos",
			"Tolentino",
			"Villareal",
		],
	},
	// Arabic names.
	{
		female: [
			"Layla",
			"Noor",
			"Yasmin",
			"Rania",
			"Salma",
			"Huda",
			"Dina",
			"Lina",
			"Mariam",
			"Amira",
		],
		male: [
			"Omar",
			"Karim",
			"Youssef",
			"Samir",
			"Tarek",
			"Khalil",
			"Nabil",
			"Ziad",
			"Rami",
			"Hassan",
		],
		lastNames: [
			"Aziz",
			"Bishara",
			"Darwish",
			"Farouk",
			"Habib",
			"Hamdan",
			"Issa",
			"Karam",
			"Khoury",
			"Mansour",
			"Najjar",
			"Nasser",
			"Sabbagh",
			"Saleh",
			"Yassin",
		],
	},
	// Turkish names.
	{
		female: ["Elif", "Zeynep", "Ayse", "Defne", "Selin", "Ece"],
		male: ["Emre", "Burak", "Kerem", "Mert", "Can", "Murat"],
		lastNames: [
			"Arslan",
			"Aydin",
			"Celik",
			"Demir",
			"Kaya",
			"Kurt",
			"Ozturk",
			"Polat",
			"Sahin",
			"Yildiz",
		],
	},
	// Hebrew names.
	{
		female: ["Noa", "Tamar", "Shira", "Yael"],
		male: ["Eitan", "Avi", "Noam", "Yonatan"],
		lastNames: [
			"Cohen",
			"Friedman",
			"Katz",
			"Levy",
			"Mizrahi",
			"Peretz",
			"Shapiro",
		],
	},
	// Persian names.
	{
		female: ["Shirin", "Parisa", "Niloufar", "Mina", "Roya", "Azadeh"],
		male: ["Dariush", "Kian", "Arash", "Reza", "Babak", "Farid"],
		lastNames: [
			"Ahmadi",
			"Jafari",
			"Karimi",
			"Moradi",
			"Rahimi",
			"Rostami",
			"Sadeghi",
			"Tehrani",
		],
	},
];

// 15 parents bring a child to the pediatrician. The child shares the family name and the phone of the parent.
const HOUSEHOLD_COUNT = 15;

const BLOOD_TYPES = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"] as const;
// The shares of the blood types in a mixed population, in percent, in the order of BLOOD_TYPES.
const BLOOD_TYPE_SHARES = [38, 34, 9, 3, 7, 6, 2, 1];

const ALLERGIES = [
	"Penicillin",
	"Latex",
	"Peanuts",
	"Grass pollen",
	"Ibuprofen",
	"Dust mites",
	"Shellfish",
	"Bee stings",
] as const;

const ADULT_CONDITIONS = [
	"Hypertension",
	"Type 2 diabetes",
	"Asthma",
	"Migraine",
	"Hypothyroidism",
	"Osteoarthritis",
	"Seasonal rhinitis",
	"High cholesterol",
] as const;

const CHILD_CONDITIONS = ["Asthma", "Eczema", "Seasonal rhinitis"] as const;

const ADULT_NOTES = [
	"Prefers morning appointments.",
	"Needs step-free access. Use the side entrance.",
	"Send reminders by text message, not by email.",
	"Prefers a phone call to a text message.",
	"Arrives early. Offer the first free slot.",
	"Anxious about needles. Book extra time for vaccines.",
	"Works night shifts. Call after 2 pm.",
	"Hard of hearing. Speak clearly and face the patient.",
	"Brings a support person to each visit.",
	"Asks for a printed summary after each visit.",
] as const;

const CHILD_NOTES = [
	"A parent books for the patient. Ask for the parent at check-in.",
	"Bring the vaccination booklet to each visit.",
	"Afternoon slots only: the patient is at school in the morning.",
	"Nervous in the waiting room. Call the family in quickly.",
] as const;

// Picks one index of `shares`, where a share of 38 comes 38 times as often as a share of 1.
function pickShare(random: Random, shares: readonly number[]): number {
	const total = shares.reduce((sum, share) => sum + share, 0);
	let cursor = random() * total;
	for (const [index, share] of shares.entries()) {
		cursor -= share;
		if (cursor < 0) {
			return index;
		}
	}
	return 0;
}

// Up to `max` different items of `pool`, in the order of the pool.
function pickSome(
	random: Random,
	pool: readonly string[],
	max: number,
): string[] {
	const wanted = new Set<number>();
	for (let draw = 0; draw < max; draw += 1) {
		wanted.add(Math.floor(random() * pool.length));
	}
	return pool.filter((_, index) => wanted.has(index));
}

type PersonName = {
	firstName: string;
	lastName: string;
	sex: "female" | "male";
	/** Gives another first name of the group of the family name. */
	nextFirstName: (sex: "female" | "male") => string;
	/** "parent" and "child" mark the two files of one household. Null for every other file. */
	household: "parent" | "child" | null;
};

// Gives the items of `items` in a random order. It starts a new round only when every item came one time.
function dealer(random: Random, items: readonly string[]): () => string {
	let deck: string[] = [];
	return () => {
		if (deck.length === 0) {
			deck = [...items];
		}
		const [item] = deck.splice(Math.floor(random() * deck.length), 1);
		return item ?? "";
	};
}

// PATIENT_COUNT different full names, sorted by last name. No two neighbors share a first name.
// Each family name names one file, except the HOUSEHOLD_COUNT households of a parent and a child.
function buildNames(random: Random): PersonName[] {
	const families = NAME_GROUPS.flatMap((group) => {
		// A first name comes again only after every name of its group. So a short list rarely shows one name twice.
		const female = dealer(random, group.female);
		const male = dealer(random, group.male);
		const nextFirstName = (sex: "female" | "male") =>
			sex === "female" ? female() : male();
		return group.lastNames.map((lastName) => ({
			lastName,
			nextFirstName,
			order: random(),
		}));
	});
	// A sort on a seeded random key shuffles the families. The first ones name the files.
	families.sort((first, second) => first.order - second.order);
	const singles = families
		.slice(0, PATIENT_COUNT - HOUSEHOLD_COUNT)
		.map((family): PersonName => {
			const sex = random() < 0.53 ? "female" : "male";
			return {
				firstName: family.nextFirstName(sex),
				lastName: family.lastName,
				sex,
				nextFirstName: family.nextFirstName,
				household: null,
			};
		});
	// The files are in random order, so a fixed step picks random parents.
	const householdStep = Math.floor(singles.length / HOUSEHOLD_COUNT);
	const children: PersonName[] = [];
	for (const [index, parent] of singles.entries()) {
		if (
			index % householdStep !== 0 ||
			index / householdStep >= HOUSEHOLD_COUNT
		) {
			continue;
		}
		parent.household = "parent";
		const sex = random() < 0.5 ? "female" : "male";
		let firstName = parent.nextFirstName(sex);
		// Two files of one household never have one full name.
		while (firstName === parent.firstName) {
			firstName = parent.nextFirstName(sex);
		}
		children.push({ ...parent, firstName, sex, household: "child" });
	}
	const names = [...singles, ...children];
	const byName = (first: PersonName, second: PersonName) =>
		first.lastName.localeCompare(second.lastName, "en") ||
		first.firstName.localeCompare(second.firstName, "en");
	names.sort(byName);
	// The list page sorts by last name. Two neighbors with one first name look like a copy, so one gets a new name.
	// The check looks at both neighbors, so the two files of a household keep different first names.
	for (let pass = 0; pass < 4; pass += 1) {
		for (const [index, name] of names.entries()) {
			const isTaken = () =>
				names[index - 1]?.firstName === name.firstName ||
				names[index + 1]?.firstName === name.firstName;
			while (isTaken()) {
				name.firstName = name.nextFirstName(name.sex);
			}
		}
		names.sort(byName);
	}
	return names;
}

// The fictional phone number of file `index`: one of 5 area codes, then the reserved 555-01xx range.
// Each file has its own number: 100 different endings for each hundred of files, with another area code.
function phoneOf(index: number): string {
	const areaCodes = ["212", "305", "415", "617", "702"];
	// 37 has no common factor with 100, so the endings do not count up with the list.
	const ending = (index * 37 + 13) % 100;
	const areaCode =
		areaCodes[(Math.floor(index / 100) + (index % 100)) % areaCodes.length];
	return `(${areaCode}) 555-01${String(ending).padStart(2, "0")}`;
}

function buildPatients(todayStart: number): PatientPlan[] {
	const random = createSeededRandom(4217);
	const practitioners = listPractitioners();
	const generalPractitioners = practitioners.filter(
		(practitioner) => practitioner.specialty === "general_practice",
	);
	const pediatrician = practitioners.find(
		(practitioner) => practitioner.specialty === "pediatrics",
	);
	const names = buildNames(random);
	// A fixed step spreads the new files over the list, so they do not sit together in the alphabet.
	const recentStep = Math.floor(PATIENT_COUNT / RECENT_COUNT);
	const todayEpochDay = epochDay(todayStart);
	// January 1 of this year. Ages and older files count back from it, so they do not move every day.
	const yearStart = new Date(
		new Date(todayStart).getFullYear(),
		0,
		1,
	).getTime();

	const patients: PatientPlan[] = names.map((name, index) => {
		const isChild =
			name.household === null ? random() < 0.26 : name.household === "child";
		// A child is 1 year old or more, so the file never opens before the birth.
		// A household child is 12 or younger and its parent is 31 or older, so the parent is 19 years older or more.
		const ageYears =
			name.household === "child"
				? randomInt(random, 1, 12)
				: name.household === "parent"
					? randomInt(random, 31, 52)
					: isChild
						? randomInt(random, 1, ADULT_AGE - 1)
						: randomInt(random, ADULT_AGE, 34) + randomInt(random, 0, 54);
		const birthDay = addDays(
			yearStart,
			-(ageYears * 365 + randomInt(random, 20, 340)),
		);
		const isRecent =
			index % recentStep === 3 && index / recentStep < RECENT_COUNT;
		// 37 has no common factor with the count, so the new files spread evenly and do not follow the alphabet.
		const recentPhase = Math.floor(
			(((Math.floor(index / recentStep) * 37) % RECENT_COUNT) *
				RECENT_CYCLE_DAYS) /
				RECENT_COUNT,
		);
		// The age of a new file grows by one each day, so its calendar day stays the same.
		// An older file opened 100 days to 7 years before January 1, and 7 days after the birth or later.
		const registeredDay = isRecent
			? addDays(
					todayStart,
					-(1 + ((todayEpochDay + recentPhase) % RECENT_CYCLE_DAYS)),
				)
			: Math.max(
					addDays(yearStart, -(100 + Math.floor(random() ** 2 * 2500))),
					addDays(birthDay, 7),
				);
		const registeredAt = atMinute(registeredDay, randomInt(random, 540, 1020));
		const registeredDaysAgo = daysBetween(registeredAt, todayStart);
		const primary = isChild
			? pediatrician
			: generalPractitioners[
					Math.floor(random() * generalPractitioners.length)
				];
		const coverageDraw = random();
		const hasEmail = random() < 0.86;
		const allergyCount = pickShare(random, [66, 26, 8]);
		const conditionCount = isChild
			? pickShare(random, [80, 20])
			: pickShare(random, [52, 34, 14]);
		const hasNote = random() < 0.36;
		const conditions = pickSome(
			random,
			isChild ? CHILD_CONDITIONS : ADULT_CONDITIONS,
			conditionCount,
		);
		const emailName = `${name.firstName}.${name.lastName}`.toLowerCase();
		return {
			id: `pat-${String(index + 1).padStart(4, "0")}`,
			fileNumber: "",
			firstName: name.firstName,
			lastName: name.lastName,
			fullName: `${name.firstName} ${name.lastName}`,
			dateOfBirth: toIsoDay(birthDay),
			sex: name.sex,
			phone: phoneOf(index),
			email: hasEmail ? `${emailName}@example.com` : null,
			primaryPractitionerId: primary?.id ?? "",
			coverage:
				coverageDraw < 0.56
					? "public"
					: coverageDraw < 0.9
						? "private"
						: "self_pay",
			bloodType: BLOOD_TYPES[pickShare(random, BLOOD_TYPE_SHARES)] ?? "O+",
			allergies: pickSome(random, ALLERGIES, allergyCount),
			conditions,
			note: hasNote
				? pickOne(random, isChild ? CHILD_NOTES : ADULT_NOTES)
				: null,
			registeredAt,
			// A long-term condition brings the patient back more often.
			visitWeight: 1 + conditions.length,
			isInTherapy: !isChild && random() < 0.13,
			hasSkinCare: random() < 0.14,
			// The first visit is 1 to 5 days after the file opens. The generator moves it to a working day.
			firstVisitOffset: isRecent
				? -registeredDaysAgo + randomInt(random, 1, 5)
				: null,
		};
	});
	// A household child has the phone and the email of the parent: the parent books the visits.
	for (const [index, name] of names.entries()) {
		const child = patients[index];
		const parent = patients.find(
			(patient, other) =>
				names[other]?.household === "parent" &&
				patient.lastName === name.lastName,
		);
		if (name.household === "child" && child && parent) {
			child.phone = parent.phone;
			child.email = parent.email;
		}
	}
	// The file numbers follow the order in which the practice opened the files. 7 leaves gaps, as closed files do.
	const byRegistration = [...patients]
		.filter((patient) => patient.firstVisitOffset === null)
		.sort((first, second) => first.registeredAt - second.registeredAt);
	for (const [rank, patient] of byRegistration.entries()) {
		patient.fileNumber = `P-${10_240 + rank * 7}`;
	}
	// A new file takes its number from its calendar day, so the number stays when another new file opens.
	// No two new files open on one day. Minus 8,000 keeps the numbers above the older files (at most P-12438).
	for (const patient of patients) {
		if (patient.firstVisitOffset !== null) {
			patient.fileNumber = `P-${epochDay(patient.registeredAt) - 8_000}`;
		}
	}
	return patients;
}

// The rows of one day. The key is the local midnight of today, so the rows change only at midnight.
let cache: { todayStart: number; patients: PatientPlan[] } | null = null;

/** Every patient with the plan fields, sorted by last name. Only the sample modules of this feature call it. */
export function listPatientPlans(now: number): readonly PatientPlan[] {
	const todayStart = startOfLocalDay(now);
	if (cache?.todayStart !== todayStart) {
		cache = { todayStart, patients: buildPatients(todayStart) };
	}
	return cache.patients;
}

/** Every patient file, sorted by last name. `now` is the current time in milliseconds since 1970. */
export function listPatients(now: number): readonly Patient[] {
	return listPatientPlans(now);
}
