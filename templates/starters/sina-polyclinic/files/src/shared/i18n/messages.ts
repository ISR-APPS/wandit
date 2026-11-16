// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// The groups `site` to `footer` hold the sample content of the public page of Sina Polyclinic.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Sina Polyclinic",
		save: "Save",
		retry: "Try again",
		signOut: "Sign out",
		language: "Language",
	},
	site: {
		metaTitle: "Sina Polyclinic — nine specialties, one record",
		metaDescription:
			"A multi-specialty polyclinic in Constantine: nine specialties, posted fees, and a visit that you book in two minutes.",
		skipToContent: "Skip to content",
		brandName: "Sina",
		brandDescriptor: "Polyclinic",
		navLabel: "Main",
		navSpecialties: "Specialties",
		navPractitioners: "Practitioners",
		navOath: "The oath",
		navAccess: "Access",
		navQuestions: "Questions",
		book: "Book a visit",
		bookShort: "Book",
		menuOpen: "Open the menu",
		menuDescription: "Sections of the page and the front desk number.",
		phoneDisplay: "031 555 0147",
		phoneHref: "tel:+213315550147",
		email: "desk@sina.example",
	},
	hero: {
		label: "Multi-specialty polyclinic — Constantine",
		titleStart: "Care starts with a",
		titleAccent: "clear sentence",
		titleEnd: ".",
		lede: "Nine specialties under one roof, one record that follows you from one consultation to the next, and a fee stated on the phone before you come. We explain before we prescribe.",
		ctaSecondary: "See specialties and fees",
		openingLabel: "Opening",
		openingValue: "Saturday to Thursday, from 08:00",
		insuranceLabel: "Insurance",
		insuranceValue: "Direct billing with the national funds",
		resultsLabel: "Results",
		resultsValue: "Analyses returned within 24 hours",
		photoAlt:
			"Consultation corridor of the clinic in daylight, with a pale teal band along the wall.",
		photoCaption: "East wing — consultation corridor, 08:40",
	},
	specialties: {
		label: "Specialties & fees",
		title: "Nine specialties, one record.",
		lede: "The fees below are the fees posted at the front desk. They include the examination, the written report, and a review of your results at the next visit. Direct billing applies to covered procedures.",
		columnSpecialty: "Specialty",
		columnPractitioner: "Practitioner",
		columnDuration: "Duration",
		columnFee: "Fee",
		footBilling: "Direct billing",
		footBillingText: "applied at the desk for covered procedures.",
		footChildren: "Children under two:",
		footChildrenText: "priority consultation, no extra fee.",
		footReport: "A written report",
		footReportText: "given with every procedure.",
		general: {
			name: "General medicine",
			description:
				"Consultation, follow-up of chronic conditions, certificates, and annual check-ups.",
			practitioner: "Dr A. Merabet",
			duration: "30 min",
			fee: "2,000 DA",
		},
		cardiology: {
			name: "Cardiology",
			description:
				"Electrocardiogram, cardiac ultrasound, blood pressure follow-up, and care after a heart attack.",
			practitioner: "Dr Y. Belhadj",
			duration: "45 min",
			fee: "4,500 DA",
		},
		pediatrics: {
			name: "Pediatrics",
			description:
				"Growth follow-up, vaccination schedule, and morning consultations with no appointment.",
			practitioner: "Dr S. Khelifi",
			duration: "30 min",
			fee: "2,500 DA",
		},
		gynecology: {
			name: "Gynecology & obstetrics",
			description:
				"Pregnancy follow-up, pelvic ultrasound, screening, and contraception.",
			practitioner: "Dr N. Bouzid",
			duration: "40 min",
			fee: "4,000 DA",
		},
		dermatology: {
			name: "Dermatology",
			description: "Dermoscopy of moles, acne, eczema, and skin allergies.",
			practitioner: "Dr R. Taleb",
			duration: "30 min",
			fee: "3,500 DA",
		},
		ophthalmology: {
			name: "Ophthalmology",
			description:
				"Visual acuity, fundus examination, eye pressure, and a prescription for glasses.",
			practitioner: "Dr M. Saadi",
			duration: "30 min",
			fee: "3,000 DA",
		},
		imaging: {
			name: "Medical imaging",
			description:
				"Abdominal and thyroid ultrasound, digital X-ray, and your images on a USB key.",
			practitioner: "Imaging department",
			duration: "20 min",
			fee: "5,000 DA",
		},
		laboratory: {
			name: "Analysis laboratory",
			description:
				"Blood count, blood sugar, and serology. Fasting samples from 07:30 to 11:00.",
			practitioner: "Laboratory department",
			duration: "10 min",
			fee: "3,500 DA",
		},
		physiotherapy: {
			name: "Physiotherapy",
			description:
				"Rehabilitation after surgery, spine care, and sports rehabilitation. Series of ten sessions.",
			practitioner: "Mr K. Hamdi",
			duration: "45 min",
			fee: "2,200 DA",
		},
	},
	figures: {
		label: "The practice in figures",
		title: "Eighteen years of care, counted honestly.",
		body: "These four figures come from the front desk register, closed on 31 December of last year. We do not count laboratory visits as consultations.",
		footSource: "Front desk register — closed on 31\u00a0December",
		footAccess: "You can read it at reception",
		patients: {
			label: "Patients followed",
			note: "Records opened since 2007",
		},
		years: {
			label: "Years of practice",
			note: "Opened in October 2007",
		},
		specialties: {
			label: "Specialties",
			note: "Eleven practitioners, one front desk",
		},
		analyses: {
			label: "Analyses per year",
			note: "Returned within 24 hours",
		},
	},
	team: {
		label: "The practitioners",
		title: "Doctors you can name.",
		body: "Each practitioner works here in their own name, with a medical council number and fixed days. You know who sees you before you come. You see the same doctor at the follow-up visit.",
		signLine: "Eleven practitioners, one front desk",
		signNote: "Medical council — eastern section",
		photoAlt:
			"Examination room: an examination table, a trolley, and a pale teal curtain in front of the window.",
		photoCaption: "Examination room 2 — west wing, 11:20",
		councilLabel: "Medical council",
		degreeLabel: "Medical degree",
		daysLabel: "Consults",
		languagesLabel: "Languages",
		rosterLabel: "Also on the roster",
		rosterDays: {
			dermatology: "Mon · Thu",
			ophthalmology: "Tue · Wed",
			physiotherapy: "Sun to Thu",
		},
		belhadj: {
			specialty: "Cardiology",
			name: "Dr Yasmine Belhadj",
			council: "No. 25-1184",
			degree: "Constantine, 2009",
			days: "Sun · Tue · Sat",
			languages: "AR · FR",
		},
		merabet: {
			specialty: "General medicine",
			name: "Dr Ahmed Merabet",
			council: "No. 25-0932",
			degree: "Algiers, 2004",
			days: "Sun to Thu",
			languages: "AR · FR · EN",
		},
		bouzid: {
			specialty: "Gynecology & obstetrics",
			name: "Dr Nadia Bouzid",
			council: "No. 25-1507",
			degree: "Oran, 2012",
			days: "Mon · Wed · Sat",
			languages: "AR · FR",
		},
		khelifi: {
			specialty: "Pediatrics",
			name: "Dr Sofiane Khelifi",
			council: "No. 25-1298",
			degree: "Constantine, 2011",
			days: "Sun · Mon · Thu",
			languages: "AR · FR",
		},
	},
	oath: {
		label: "The oath",
		title: "Five sentences we keep.",
		body: "The Hippocratic oath is long. Here is what it gives in our clinic on an ordinary Tuesday morning: five commitments that the front desk and the doctors apply without discussion.",
		photoAlt:
			"A tray of sterilized instruments on a white cloth, in the treatment room.",
		photoCaption: "Sterilized tray — treatment room, 07:55",
		signLine: "Signed by the eleven practitioners",
		signNote: "Posted at reception since 2007",
		time: {
			kicker: "Time",
			sentence:
				"An appointment starts on time. If the doctor runs late, the front desk calls you before you leave home.",
		},
		fee: {
			kicker: "Fee",
			sentence:
				"The price of the procedure is stated on the phone, before the consultation, and it is the same when you pay.",
		},
		record: {
			kicker: "Record",
			sentence:
				"Reports, analyses, and images belong to you: one record, given on a USB key or by email, on request.",
		},
		prescription: {
			kicker: "Prescription",
			sentence:
				"Each line is explained before you leave: what it is for, for how many days, and what to watch.",
		},
		doubt: {
			kicker: "Doubt",
			sentence:
				"When the diagnosis is not certain, we say so, and we refer you to the colleague best placed to help.",
		},
	},
	booking: {
		label: "Appointments",
		title: "Choose your slot.",
		lede: "Pick a specialty, a day, and a time. Your request opens as an email to the front desk, which confirms by phone within one working hour. No deposit is asked.",
		specialtyLabel: "Specialty",
		dayLabel: "Day",
		slotsLabel: "Available slots",
		slotsLegend: "Struck through = full",
		slotFull: "full",
		dayFull:
			"No free slot is left on this day. Pick another day, or call the front desk.",
		requestLabel: "Your request",
		requestAt: "at",
		send: "Request this slot by email",
		orCall: "or call",
		honestNote:
			"No call from us before 18:00? Phone the front desk: the request did not arrive.",
		mailSubject: "Appointment request",
		mailGreeting: "Hello,",
		mailRequest: "I would like to book this visit:",
		mailName: "My name:",
		mailPhone: "My phone number:",
		mailReason: "Reason for the visit (optional):",
		days: {
			sunday: { name: "Sunday", option: "Sunday — morning and afternoon" },
			monday: { name: "Monday", option: "Monday — morning" },
			tuesday: { name: "Tuesday", option: "Tuesday — all day" },
			wednesday: { name: "Wednesday", option: "Wednesday — afternoon" },
			thursday: { name: "Thursday", option: "Thursday — morning" },
			saturday: { name: "Saturday", option: "Saturday — all day" },
		},
		photoAlt:
			"Waiting room: a light wood bench, pale teal cushions, and light from the window.",
		photoCaption: "Waiting room — ground floor, 09:05",
		bringLabel: "What to bring on the day",
		bringCard: "Your health insurance card and an identity document",
		bringPrescriptions: "Your current prescriptions, as they are",
		bringResults: "The analyses and images of the last six months",
		bringChild: "For a child: the health booklet",
	},
	access: {
		label: "Hours & access",
		columnDay: "Day",
		columnHours: "Consultations",
		weekdays: "Sunday → Thursday",
		weekdaysHours: "08:00 — 19:00",
		friday: "Friday",
		fridayHours: "closed",
		saturday: "Saturday",
		saturdayHours: "08:00 — 18:00",
		laboratory: "Laboratory",
		laboratoryHours: "07:30 — 11:00",
		urgent: "Minor emergencies",
		urgentHours: "between appointments",
		addressName: "Sina Polyclinic",
		addressStreet: "14, rue des Jasmins — Cité des Jardins",
		addressCity: "25000 Constantine",
		note: "Step-free access through the main door. A car park of 12 spaces is at the back, with its entrance on rue des Jasmins. The bus stop “Jardins centre” is 120 meters away.",
	},
	faq: {
		label: "Frequent questions",
		title: "What people ask us on the phone.",
		note: "Your question is not here? Call the front desk on 031\u00a0555\u00a00147: 08:00 to 19:00, Saturday to 18:00, closed on Friday.",
		analyses: {
			question: "Do I need an appointment for analyses?",
			answer:
				"No. The laboratory receives patients with no appointment from 07:30 to 11:00, fasting. Results leave by email within 24 hours, or you collect them at the front desk.",
		},
		insurance: {
			question: "Do you accept the national insurance card?",
			answer:
				"Yes, for the procedures that the national health funds cover. Direct billing is applied at the desk, and we tell you the amount you pay before the consultation.",
		},
		parking: {
			question: "Is there a car park?",
			answer:
				"Twelve spaces behind the building, with the entrance on rue des Jasmins. Wheelchair access is step-free through the main door.",
		},
		saturday: {
			question: "Can I consult on Saturday?",
			answer:
				"Yes, from 08:00 to 18:00 in cardiology, gynecology, and medical imaging. The laboratory keeps its usual hours, from 07:30 to 11:00.",
		},
		report: {
			question: "How do I get a copy of a report?",
			answer:
				"At the front desk with an identity document, or by secure email if you asked for it during the consultation.",
		},
		emergency: {
			question: "Do you take emergencies?",
			answer:
				"Minor emergencies, such as a fever, a wound, or a sprain, are seen between two appointments. For a life-threatening emergency, call the emergency services or go to the nearest hospital.",
		},
	},
	footer: {
		descriptor: "Polyclinic — Constantine",
		addressTitle: "Address",
		addressStreet: "14, rue des Jasmins",
		addressDistrict: "Cité des Jardins",
		addressCity: "25000\u00a0Constantine",
		addressParking: "Car park at the back, 12\u00a0spaces",
		contactTitle: "Contact",
		contactEmergency: "Life-threatening emergency: call the emergency services",
		clinicTitle: "The clinic",
		noticesTitle: "Notices",
		noticeLicense: "Health authority license no. 25/402",
		noticeCouncil: "Medical council, eastern section",
		noticeSmoking: "Non-smoking premises",
		rights: "© Sina Polyclinic. All rights reserved.",
		hours: "Sun to Thu 08:00 — 19:00 · Sat 08:00 — 18:00",
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
