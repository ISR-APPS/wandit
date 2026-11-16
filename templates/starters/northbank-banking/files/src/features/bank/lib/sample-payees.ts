// The saved payees of the business: suppliers, contractors, bills, tax offices, and the payroll service.
// It stands in for a `payees` table. sample-transactions.ts pays them on a schedule or at random.
// Every name, bank, and number here is fictional.

/** The payee groups, in the order of the tabs of the payees page. */
export const PAYEE_CATEGORIES = [
	"supplier",
	"contractor",
	"bills",
	"tax",
	"payroll",
] as const;

/** One payee group. Its label is the message key `payees.categories.<category>`. */
export type PayeeCategory = (typeof PAYEE_CATEGORIES)[number];

/** One saved payee. */
export type Payee = {
	/** Stable id, also the `$payeeId` of the detail page URL. */
	id: string;
	name: string;
	/** What the business buys from the payee, in a few words. */
	note: string;
	category: PayeeCategory;
	/** "ach" for a bank transfer that posts the next day, "wire" for a same-day transfer. */
	method: "ach" | "wire";
	/** The bank of the payee. */
	bankName: string;
	/** The last 4 digits of the account number of the payee. */
	accountEnding: string;
	/** The last 4 digits of the routing number of the payee bank. */
	routingEnding: string;
	/** Days between the save of the payee and today. */
	addedDaysAgo: number;
};

/** Every saved payee. */
export const PAYEES: readonly Payee[] = [
	{
		id: "cedar-ridge",
		name: "Cedar Ridge Timber Supply",
		note: "Oak, walnut, and ash boards",
		category: "supplier",
		method: "ach",
		bankName: "Quillstone Credit Union",
		accountEnding: "3381",
		routingEnding: "0217",
		addedDaysAgo: 1_480,
	},
	{
		id: "holloway",
		name: "Holloway Hardware Wholesale",
		note: "Hinges, runners, and fittings",
		category: "supplier",
		method: "ach",
		bankName: "Tallowmere Bank",
		accountEnding: "9054",
		routingEnding: "5520",
		addedDaysAgo: 1_210,
	},
	{
		id: "brightcoat",
		name: "Brightcoat Finishes",
		note: "Lacquers, oils, and stains",
		category: "supplier",
		method: "ach",
		bankName: "Marrowfield Trust",
		accountEnding: "1177",
		routingEnding: "8841",
		addedDaysAgo: 960,
	},
	{
		id: "mill-sheet",
		name: "Mill & Sons Sheet Goods",
		note: "Plywood and veneered panels",
		category: "supplier",
		method: "wire",
		bankName: "Brindle Bay Savings",
		accountEnding: "6620",
		routingEnding: "3306",
		addedDaysAgo: 870,
	},
	{
		id: "northgate",
		name: "Northgate Freight",
		note: "Delivery of finished pieces",
		category: "supplier",
		method: "ach",
		bankName: "Quillstone Credit Union",
		accountEnding: "4408",
		routingEnding: "0217",
		addedDaysAgo: 640,
	},
	{
		id: "saltmarsh",
		name: "Saltmarsh Upholstery",
		note: "Fabric and seat foam",
		category: "supplier",
		method: "ach",
		bankName: "Tallowmere Bank",
		accountEnding: "2290",
		routingEnding: "5520",
		addedDaysAgo: 410,
	},
	{
		id: "gristwood",
		name: "Gristwood Machinery Service",
		note: "Service of the CNC router and saws",
		category: "supplier",
		method: "ach",
		bankName: "Marrowfield Trust",
		accountEnding: "7315",
		routingEnding: "8841",
		addedDaysAgo: 300,
	},
	{
		id: "ines-varga",
		name: "Ines Varga",
		note: "Kitchen and shopfit installation",
		category: "contractor",
		method: "ach",
		bankName: "Brindle Bay Savings",
		accountEnding: "5021",
		routingEnding: "3306",
		addedDaysAgo: 720,
	},
	{
		id: "tobias-lindqvist",
		name: "Tobias Lindqvist",
		note: "CAD drawings and cut lists",
		category: "contractor",
		method: "ach",
		bankName: "Quillstone Credit Union",
		accountEnding: "8863",
		routingEnding: "0217",
		addedDaysAgo: 515,
	},
	{
		id: "ruth-achterberg",
		name: "Ruth Achterberg",
		note: "Monthly bookkeeping",
		category: "contractor",
		method: "ach",
		bankName: "Tallowmere Bank",
		accountEnding: "0449",
		routingEnding: "5520",
		addedDaysAgo: 1_020,
	},
	{
		id: "kwame-asante",
		name: "Kwame Asante-Boyd",
		note: "Site fitting and repairs",
		category: "contractor",
		method: "ach",
		bankName: "Marrowfield Trust",
		accountEnding: "6712",
		routingEnding: "8841",
		addedDaysAgo: 190,
	},
	{
		id: "larch-street",
		name: "Larch Street Properties",
		note: "Workshop rent, unit 4",
		category: "bills",
		method: "ach",
		bankName: "Brindle Bay Savings",
		accountEnding: "1904",
		routingEnding: "3306",
		addedDaysAgo: 2_150,
	},
	{
		id: "riverside-power",
		name: "Riverside Power & Water",
		note: "Electricity and water",
		category: "bills",
		method: "ach",
		bankName: "Tallowmere Bank",
		accountEnding: "7788",
		routingEnding: "5520",
		addedDaysAgo: 2_140,
	},
	{
		id: "ashbury-mutual",
		name: "Ashbury Mutual Insurance",
		note: "Liability and workshop cover",
		category: "bills",
		method: "ach",
		bankName: "Marrowfield Trust",
		accountEnding: "3027",
		routingEnding: "8841",
		addedDaysAgo: 1_390,
	},
	{
		id: "clearline",
		name: "Clearline Telecom",
		note: "Phones and fiber line",
		category: "bills",
		method: "ach",
		bankName: "Quillstone Credit Union",
		accountEnding: "5536",
		routingEnding: "0217",
		addedDaysAgo: 1_100,
	},
	{
		id: "fennick-waste",
		name: "Fennick Waste Services",
		note: "Sawdust and offcut collection",
		category: "bills",
		method: "ach",
		bankName: "Brindle Bay Savings",
		accountEnding: "8250",
		routingEnding: "3306",
		addedDaysAgo: 880,
	},
	{
		id: "department-revenue",
		name: "Department of Revenue",
		note: "Monthly sales tax",
		category: "tax",
		method: "ach",
		bankName: "Treasury Clearing Account",
		accountEnding: "0001",
		routingEnding: "0090",
		addedDaysAgo: 1_900,
	},
	{
		id: "tax-collector",
		name: "Office of the Tax Collector",
		note: "Quarterly estimated income tax",
		category: "tax",
		method: "wire",
		bankName: "Treasury Clearing Account",
		accountEnding: "0002",
		routingEnding: "0090",
		addedDaysAgo: 1_880,
	},
	{
		id: "tidewell-payroll",
		name: "Tidewell Payroll Services",
		note: "Net pay of 14 employees, twice a month",
		category: "payroll",
		method: "ach",
		bankName: "Marrowfield Trust",
		accountEnding: "9902",
		routingEnding: "8841",
		addedDaysAgo: 1_630,
	},
];

/** One payee by id, or undefined for an id from a changed URL. */
export function findPayee(id: string): Payee | undefined {
	return PAYEES.find((payee) => payee.id === id);
}
