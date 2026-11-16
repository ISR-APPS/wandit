// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/**
 * The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable.
 * The groups from `site` to `imprint` hold the copy of the Le Kiosque home page, one group per section.
 */
export const messages = {
	common: {
		appName: "Le Kiosque",
		save: "Save",
		retry: "Try again",
		signOut: "Sign out",
		language: "Language",
	},
	site: {
		metaTitle: "Le Kiosque — the café's paper, Lyon",
		metaDescription:
			"Le Kiosque is a coffee bar and roaster on the Presqu'île in Lyon. Its menu, its roasts, and its news, set as a newspaper.",
		brand: "Le Kiosque",
		dateline: "Lyon — Tuesday 28 July 2026",
		edition: "No. 142 — Third year",
		weather: "Bright sun over the Presqu'île, 31° · Coffee: €2",
		tagline:
			"The café's paper — on the counter every Tuesday · 12 Rue du Marbre, Lyon 2nd",
		navLabel: "Sections of the paper",
		pageAbbr: "p.",
		navFront: "Front page",
		navRoast: "The roast",
		navMenu: "The menu",
		navArchives: "Archives",
		navLetters: "Letters",
		menuOpen: "Sections",
		menuOpenLabel: "Open the sections of the paper",
		menuTitle: "In this edition",
		menuHours: "Tuesday to Sunday, 7:30\u00a0am – 6:30\u00a0pm",
		writeToUs: "Write to us",
		photoCredit: "Photo: the newsroom",
		phoneDisplay: "04 65 71 17 09",
		phoneHref: "tel:+33465711709",
		email: "newsroom@le-kiosque.example",
		emailHref: "mailto:newsroom@le-kiosque.example",
	},
	front: {
		kicker: "Roasting — lot 07",
		headline: "The Kivu reaches the counter",
		deck: "Landed Tuesday on the Marseille freight, roasted Thursday in the back room, served Friday from 7:30\u00a0am.",
		byline: "By Nadia Berrah · Head roaster",
		dateline: "Lyon, 2nd arr. —",
		body1:
			"The sixty-kilo sack arrived at dawn on Tuesday with the Marseille freight, by way of the dry port at Vénissieux, and it did not linger on the platform. The Kivu, lot 07, picked in January on the hills above Minova at 1,900\u00a0metres, cleared counter customs by late morning: the head roaster signed the delivery note between two macchiatos, under the eye of the regulars.",
		body2:
			"Roasting is on Thursday: an eighteen-kilo drum, three batches, a gentle curve. Then forty-eight hours of rest, as it should be. First service is Friday at 7:30, on filter first and on espresso the week after. The newsroom tasted the lot ahead of release and notes apricot, cocoa, and a finish that alone justifies the walk down from the Croix-Rousse.",
		body3Lead:
			"The 250\u00a0g bag goes on sale on Saturday, ground to order, within reason — the house keeps enough to last until the next harvest. The big table is booked by telephone or with the coupon on",
		body3Link: "page 5",
		jump: "Continued on p. 2 →",
		plateLabel:
			"Halftone drawing: the shopfront of Le Kiosque, with its pavement board and a pigeon on the sign.",
		plateSign: "LE KIOSQUE",
		plateWindow: "COFFEE €2",
		platePress: "THE PRESS",
		plateBoardTop: "KIVU",
		plateBoardBottom: "LOT 07",
		caption:
			"No. 12, Rue du Marbre, Tuesday morning. The pigeon is a subscriber.",
		serviceTitle: "At the counter today",
		serviceBody:
			"Kivu lot 07 on filter, notes of apricot and cocoa. Batch brew ready at 7:30 sharp. Bright sun forecast: the terrace opens at 8. The French toast waits for Saturday.",
	},
	roast: {
		page: "Page 2",
		title: "The roast & the method",
		note: "What the house is preparing",
		briefsLabel: "In brief",
		brief1Slug: "Counter",
		brief1Title: "Batch brew stays at €3",
		brief1Body:
			"The newsroom maintains it is the best value on the Presqu'île. Ready at 7:30, brewed again at 11.",
		brief2Slug: "Terrace",
		brief2Title: "Four more tables in August",
		brief2Body:
			"Subject to the town hall of the 2nd. The file left on Monday, stamped and weighed.",
		brief3Slug: "Beans",
		brief3Title: "The bag drops under €10",
		brief3Body:
			"250\u00a0g of Kivu lot 07 at €9.80, ground to order. Details on page 3.",
		brief4Slug: "Workshop",
		brief4Title: "An introduction to filter",
		brief4Body:
			"First Sunday of the month, eight places, ninety minutes. Sign up at the counter only.",
		slug: "Method",
		headline: "Slow brewing takes back the bar",
		deck: "Less pressure, more minutes: the filter bar doubles its share of the counter.",
		byline: "By Émile Roche · Head waiter",
		dateline: "Lyon, 2nd arr. —",
		body1:
			"We pushed the walls back, or at least the machine. Since Monday the filter bar fills half the counter: two pour-over cones, a glass carafe, a scale true to the gram, and a grinder kept for gentle coffees. The gesture is slow, deliberate, and timed by nobody.",
		body2:
			"The percolator regulars frown, then taste, then come back. Émile Roche keeps the register of converts: seventeen since Monday, two of them die-hards of the short espresso. The cappuccino does not move by a cent — the house knows where it comes from and who keeps it going.",
		plateLabel:
			"Halftone drawing: a steaming cup of coffee on its saucer, a spoon beside it.",
		caption: "Three and a half minutes a cup, not one less.",
		jump: "Continued on p. 3 →",
	},
	press: {
		label: "On press",
		labelRest: "tomorrow's front page sets before your eyes",
		sectionLabel: "Tomorrow's front page, on press",
		marginLeft1: "Press B — speed 7",
		marginLeft2: "Lock-up — 3\u00a0am",
		marginLeft3: "45 g paper — ink no. 1",
		marginRight1: "Print run — 200 copies",
		marginRight2: "Out at 7:30\u00a0am",
		marginRight3: "Coffee stays at €2",
		proof: "Proof — No. 143",
		dateline: "Tomorrow — Wednesday 29 July 2026",
		edition: "No. 143",
		kicker: "Special edition — the roast",
		headline: "We roast on Thursday",
		deck: "Three batches, forty-eight hours of rest, first service Friday at 7:30.",
		col1Dateline: "Minova, Kivu —",
		col1Body1:
			"Picked in January at 1,900\u00a0metres, dried twenty days on raised beds, lot 07 travelled in a ventilated hold. Sixty kilos exactly, not a sack more, not a sack less.",
		col1Body2:
			"The unloading dock is the pavement; customs is the counter. The curious may watch, on condition that they order something.",
		col2Dateline: "The back room —",
		col2Body1:
			"Three batches in the eighteen-kilo drum, a gentle curve, a long development. Nadia Berrah aims for apricot; she stops at first crack, not before, not after.",
		col2Body2:
			"Sixty kilos of green beans give forty-nine kilos roasted. The difference is water — and the house does not sell hot water, except as tea.",
		plateLabel:
			"Halftone portrait: Nadia Berrah, head roaster, hair in a bun, in a tied apron.",
		caption: "Nadia Berrah at the drum, Thursday.",
		stamp: "Continued p. 4 →",
	},
	stopPress: {
		label: "Stop press",
		tag: "Stop press",
		lead: "French toast is back on",
		when: "Saturday 1 August, from 9\u00a0am",
		tail: ". The regulars have been told.",
	},
	menu: {
		page: "Page 3",
		title: "Small ads — the menu",
		note: "Net prices, service included",
		intro:
			"The house publishes its menu the way it publishes everything else: in columns, with no retouched photos, prices set in plain figures. Everything is served Tuesday to Sunday, 7:30\u00a0am – 6:30\u00a0pm.",
		coffees: "Coffees",
		filters: "Gentle filters",
		sweets: "Sweets & beans",
		espressoName: "Espresso.",
		espressoNote: "House blend, roasted this week, pulled short on request.",
		noisetteName: "Noisette.",
		noisetteNote:
			"Espresso stained with a cloud of whole milk from a farm in Chaponost.",
		cappuccinoName: "Cappuccino.",
		cappuccinoNote: "Tight foam, cocoa from the roaster next door on request.",
		flatWhiteName: "Flat white.",
		flatWhiteNote:
			"Double ristretto, micro-foamed milk, a 16\u00a0cl cup, no discussion.",
		pourOverName: "Pour-over, Kivu lot 07.",
		pourOverNote:
			"Notes of apricot and cocoa, poured by hand, for one serious person.",
		carafeName: "Carafe for two.",
		carafeNote: "Forty minutes of conversation, guaranteed by the glassware.",
		batchName: "Batch brew.",
		batchNote:
			"The filter of the day, ready at 7:30 sharp, brewed again at 11.",
		mysteryName: "The mystery filter.",
		mysteryNote:
			"Tuesdays only, chosen by Sofia, revealed after the first sip.",
		toastName: "French toast.",
		toastNote:
			"Saturdays only, yesterday's brioche, from 9\u00a0am until it runs out.",
		cookieName: "Buckwheat cookie.",
		cookieNote: "70% chocolate chips, sea salt, baked that same morning.",
		flanName: "Vanilla flan.",
		flanNote: "Cut thick, pastry baked through, as it should be.",
		beansName: "Beans by the bag.",
		beansNote: "Kivu lot 07 in a 250\u00a0g bag, ground to order.",
	},
	archives: {
		page: "Page 4",
		title: "Our past front pages",
		note: "Three summers of editions",
		intro:
			"Le Kiosque has been out since October 2023. Every big date of the house got its front page. The originals hang framed by the machine, and the regulars know the headlines by heart.",
		figuresLabel: "The paper in figures",
		figureEditions: "Editions out",
		figureLots: "Lots roasted",
		figureFramed: "Front pages framed",
		edition1Number: "No. 001",
		edition1Date: "Tuesday 10 October 2023",
		edition1Title: "We open",
		edition1Body:
			"The shutter rises at 12 Rue du Marbre. Two tables, eight chairs, a second-hand machine, and plenty of nerve.",
		edition2Number: "No. 038",
		edition2Date: "Saturday 29 June 2024",
		edition2Title: "The machine has arrived",
		edition2Body:
			"Three groups, fifteen bars, a month of tuning. The old one retires, framed on the back wall.",
		edition3Number: "No. 094",
		edition3Date: "Tuesday 16 September 2025",
		edition3Title: "We roast our own",
		edition3Body:
			"An eighteen-kilo drum moves into the back room. The Presqu'île smells of cocoa on Thursdays.",
		edition4Number: "No. 129",
		edition4Date: "Tuesday 12 May 2026",
		edition4Title: "The terrace, at last",
		edition4Body:
			"Four tables in the sun, the permit of the town hall of the 2nd, and the pigeons as first subscribers.",
	},
	newsroom: {
		page: "Page 4, continued",
		title: "The newsroom",
		note: "Three bylines, one counter",
		nadiaName: "Nadia Berrah",
		nadiaRole: "Head roaster — The roast column",
		nadiaQuote:
			"“I taste every lot twice: when I wake up, then at closing. If it holds up both times, it makes the front page.”",
		nadiaPlate:
			"Halftone portrait: Nadia Berrah, hair in a bun, small earrings.",
		emileName: "Émile Roche",
		emileRole: "Head waiter — Letters to the editor",
		emileQuote:
			"“A regular is a column that comes back every day. We never cut a column.”",
		emilePlate: "Halftone portrait: Émile Roche, flat cap and beard.",
		sofiaName: "Sofia Marino",
		sofiaRole: "Morning correspondent — The terrace column",
		sofiaQuote:
			"“At 7:30 the Presqu'île reads itself in the coffee grounds. I note everything, mostly what does not change.”",
		sofiaPlate: "Halftone portrait: Sofia Marino, short bob and round glasses.",
	},
	letters: {
		page: "Page 5",
		title: "Letters to the editor",
		note: "Answered before the next edition",
		introDateline: "To our readers —",
		intro1:
			"The big table to book, a bag of beans to order, a firm opinion on the cappuccino? Write to the paper. The newsroom reads everything, answers everything, and pins the best letters by the machine.",
		intro2Lead:
			"The big table (eight places, at the back, under the framed front pages) is booked by telephone at",
		intro2Tail:
			"or with the coupon on this page. The roasts are open to visitors on Thursdays, on a kind word.",
		intro3:
			"The paper is out every Tuesday. On Mondays the café is closed: we count the cups and lock up the next front page.",
		letterSlug: "Letter of the week",
		letterQuote:
			"“Your batch brew reconciled me with Mondays, which is quite something, since you are closed on Mondays.”",
		letterFrom: "M. G., Croix-Rousse — pinned by the machine",
		couponNumber: "Coupon No. 142",
		couponTitle: "Write to the paper",
		couponDeck: "Cut out, pick a subject, or let the telephone play postman.",
		couponSubjects: "Subject of your letter",
		subjectTable: "Book the big table",
		subjectBeans: "Order beans",
		subjectLetter: "A letter for the editor",
		subjectOther: "Something else",
		couponWrite: "Write to the paper",
		couponCall: "Call the desk",
		couponNote:
			"Answer before the next edition — Tuesday to Sunday, 7:30\u00a0am – 6:30\u00a0pm.",
		mailSubjectPrefix: "Le Kiosque — ",
	},
	imprint: {
		addressTitle: "Address",
		addressLine1: "12 Rue du Marbre",
		addressLine2: "69002 Lyon — Presqu'île",
		addressLine3: "Metro Cordeliers, Grenette exit",
		hoursTitle: "Hours",
		hoursLine1: "Tuesday to Sunday",
		hoursLine2: "7:30\u00a0am – 6:30\u00a0pm",
		hoursLine3: "Mondays, the paper goes to press.",
		contactTitle: "Contact",
		imprintLead: "The imprint —",
		imprintBody:
			"Le Kiosque, the café's paper, is out every Tuesday since October 2023, with special editions when the beans arrive. Publisher and head roaster: Nadia Berrah. Head waiter and letters editor: Émile Roche. Morning correspondent: Sofia Marino. Composed and printed on the premises, Presqu'île, Lyon.",
		copyright: "© 2026 Le Kiosque — Edition No. 142, third year",
		priceLine: "Coffee is €2. It does not go up this season.",
	},
	login: {
		title: "Sign in",
		subtitle: "Use your email and password.",
		signUpTitle: "Create an account",
		signUpSubtitle: "Your account works at once.",
		email: "Email",
		emailPlaceholder: "you@example.com",
		password: "Password",
		confirmPassword: "Confirm password",
		submit: "Sign in",
		signUpSubmit: "Create account",
		sending: "Please wait…",
		toSignUp: "No account yet? Create one",
		toSignIn: "Already have an account? Sign in",
		passwordMismatch: "The two passwords do not match.",
		error: "Sign-in failed. Check your email and password.",
		signUpError:
			"Sign-up failed. Try again, or sign in if you already have an account.",
	},
	profile: {
		title: "Profile",
		fullName: "Full name",
		fullNamePlaceholder: "Your display name",
		saved: "Your profile was updated.",
		loadError: "Your profile did not load. Check the connection and try again.",
		saveError: "Your profile was not saved. Try again.",
	},
	shell: {
		toggleSidebar: "Toggle sidebar",
		profile: "Profile",
		signOutError: "Sign-out failed. Try again.",
	},
	table: {
		search: "Search",
		previous: "Previous",
		next: "Next",
	},
} as const;
