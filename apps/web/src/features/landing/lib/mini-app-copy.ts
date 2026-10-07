/**
 * Text inside the four simulated apps of the landing page, in en, fr and ar.
 * This is app content, not page chrome, so it is not in the dictionaries.
 * Only components/mini-apps.tsx reads it. Numbers use a no-break space between
 * thousands, so Arabic bidi keeps "48 200" as one number.
 */

import type { Locale } from "@/lib/i18n";

/** Labels of the four tabs in the bottom bar of a mobile app. */
type TabLabels = readonly [string, string, string, string];

type Barber = {
	name: string;
	/** One or two letters in the avatar circle. */
	initials: string;
	specialty: string;
	/** Average review score out of 5, already formatted. */
	rating: string;
};

type BarberCopy = {
	/** Line above the shop name. It greets the signed-in client. */
	greeting: string;
	/** Letters in the avatar of the signed-in client. */
	clientInitials: string;
	pickDay: string;
	month: string;
	/** Monday to Friday, on the five date chips. */
	weekdays: readonly [string, string, string, string, string];
	pickTime: string;
	freeSlots: string;
	pickBarber: string;
	seeAll: string;
	barbers: readonly [Barber, Barber];
	/** Text of the main button. It names the selected slot, 14:30. */
	book: string;
	price: string;
	tabs: TabLabels;
};

type Run = {
	name: string;
	initial: string;
	/** When and where the run took place. */
	when: string;
	distance: string;
	pace: string;
};

type RunningCopy = {
	/** Name of the running club under the app name. */
	club: string;
	week: string;
	/** Distance run by the club this week. The unit is separate. */
	total: string;
	/** Change against last week. Shown left to right in every language. */
	trend: string;
	unit: string;
	goal: string;
	/** Monday to Sunday, under the bars of the weekly chart. */
	dayLetters: readonly [string, string, string, string, string, string, string];
	clubRuns: string;
	seeAll: string;
	runs: readonly [Run, Run, Run];
	start: string;
	tabs: TabLabels;
};

/** Payment state of an invoice. It picks the color of the status pill. */
type InvoiceStatus = "paid" | "pending" | "overdue";

type InvoiceRow = {
	client: string;
	initials: string;
	number: string;
	amount: string;
	status: InvoiceStatus;
};

type Kpi = { label: string; amount: string; note: string };

type InvoicesCopy = {
	/** Sidebar items: dashboard, invoices, clients, reports, settings. */
	nav: readonly [string, string, string, string, string];
	userName: string;
	userRole: string;
	userInitials: string;
	title: string;
	period: string;
	search: string;
	newInvoice: string;
	/** One KPI tile per invoice status, with the total of that status. */
	kpis: Record<InvoiceStatus, Kpi>;
	recent: string;
	viewAll: string;
	/** Table header: client, invoice number, amount, status. */
	columns: readonly [string, string, string, string];
	rows: readonly [InvoiceRow, InvoiceRow, InvoiceRow, InvoiceRow, InvoiceRow];
	statuses: Record<InvoiceStatus, string>;
	chartTitle: string;
	chartTotal: string;
	chartNote: string;
	/** May to October, under the bars of the cash chart. */
	months: readonly [string, string, string, string, string, string];
};

type YogaClass = {
	day: string;
	time: string;
	name: string;
	teacher: string;
};

type YogaCopy = {
	links: readonly [string, string, string, string];
	/** The call to action, in the nav and in the hero of the studio page. */
	book: string;
	eyebrow: string;
	headline: string;
	body: string;
	schedule: string;
	nextLabel: string;
	nextClass: string;
	nextMeta: string;
	weekTitle: string;
	classes: readonly [YogaClass, YogaClass, YogaClass, YogaClass, YogaClass];
};

type MiniAppCopy = {
	barber: BarberCopy;
	running: RunningCopy;
	invoices: InvoicesCopy;
	yoga: YogaCopy;
};

/** All mini app text, keyed by the language of the app (not of the page). */
export const MINI_APP_COPY = {
	en: {
		barber: {
			greeting: "Good evening, Amine",
			clientInitials: "AM",
			pickDay: "Pick a day",
			month: "October",
			weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
			pickTime: "Pick a time",
			freeSlots: "5 free",
			pickBarber: "Your barber",
			seeAll: "See all",
			barbers: [
				{
					name: "Yacine",
					initials: "YB",
					specialty: "Fades and beard",
					rating: "4.9",
				},
				{
					name: "Riad",
					initials: "RK",
					specialty: "Classic cuts",
					rating: "4.8",
				},
			],
			book: "Book 14:30",
			price: "800 DA",
			tabs: ["Home", "Bookings", "Messages", "Profile"],
		},
		running: {
			club: "Oran Runners",
			week: "This week",
			total: "32.4",
			trend: "+12%",
			unit: "km",
			goal: "Goal 40 km",
			dayLetters: ["M", "T", "W", "T", "F", "S", "S"],
			clubRuns: "Club runs",
			seeAll: "See all",
			runs: [
				{
					name: "Sara",
					initial: "S",
					when: "This morning, Corniche",
					distance: "8.2 km",
					pace: "5:12 /km",
				},
				{
					name: "Lina",
					initial: "L",
					when: "Yesterday, Canastel",
					distance: "12.0 km",
					pace: "5:48 /km",
				},
				{
					name: "Riad",
					initial: "R",
					when: "Saturday, Santa Cruz",
					distance: "21.1 km",
					pace: "4:56 /km",
				},
			],
			start: "Start a run",
			tabs: ["Home", "Runs", "Club", "Profile"],
		},
		invoices: {
			nav: ["Dashboard", "Invoices", "Clients", "Reports", "Settings"],
			userName: "Lina Bensalem",
			userRole: "Owner",
			userInitials: "LB",
			title: "Dashboard",
			period: "October 2026",
			search: "Search invoices",
			newInvoice: "New invoice",
			kpis: {
				paid: {
					label: "Paid",
					amount: "48\u00a0200 DA",
					note: "+44% this month",
				},
				pending: {
					label: "Pending",
					amount: "12\u00a0750 DA",
					note: "6 invoices",
				},
				overdue: {
					label: "Overdue",
					amount: "3\u00a0400 DA",
					note: "1 invoice",
				},
			},
			recent: "Recent invoices",
			viewAll: "View all",
			columns: ["Client", "Invoice", "Amount", "Status"],
			rows: [
				{
					client: "Atelier Riad",
					initials: "AR",
					number: "INV-1042",
					amount: "8\u00a0400 DA",
					status: "paid",
				},
				{
					client: "Sara Haddad",
					initials: "SH",
					number: "INV-1041",
					amount: "3\u00a0200 DA",
					status: "pending",
				},
				{
					client: "Oran Print",
					initials: "OP",
					number: "INV-1040",
					amount: "12\u00a0000 DA",
					status: "paid",
				},
				{
					client: "Café Yacine",
					initials: "CY",
					number: "INV-1039",
					amount: "3\u00a0400 DA",
					status: "overdue",
				},
				{
					client: "Amine Design",
					initials: "AD",
					number: "INV-1038",
					amount: "6\u00a0900 DA",
					status: "paid",
				},
			],
			statuses: { paid: "Paid", pending: "Pending", overdue: "Overdue" },
			chartTitle: "Cash in",
			chartTotal: "198\u00a0400 DA",
			chartNote: "Last 6 months",
			months: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
		},
		yoga: {
			links: ["Classes", "Teachers", "Pricing", "Contact"],
			book: "Book a class",
			eyebrow: "Yoga studio in Oran",
			headline: "Breathe slow. Move with the sun.",
			body: "Sunrise flow, yin and prenatal classes in a bright studio by the sea.",
			schedule: "See the schedule",
			nextLabel: "Next class",
			nextClass: "Sunrise flow",
			nextMeta: "07:30, 4 spots left",
			weekTitle: "This week",
			classes: [
				{
					day: "Mon",
					time: "07:30",
					name: "Sunrise flow",
					teacher: "with Lina",
				},
				{ day: "Tue", time: "18:30", name: "Yin yoga", teacher: "with Sara" },
				{
					day: "Wed",
					time: "12:15",
					name: "Lunch flow",
					teacher: "with Amine",
				},
				{ day: "Thu", time: "19:00", name: "Prenatal", teacher: "with Lina" },
				{
					day: "Sat",
					time: "09:00",
					name: "Beach flow",
					teacher: "with Sara",
				},
			],
		},
	},
	fr: {
		barber: {
			greeting: "Bonsoir, Amine",
			clientInitials: "AM",
			pickDay: "Choisis un jour",
			month: "Octobre",
			weekdays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
			pickTime: "Choisis une heure",
			freeSlots: "5 libres",
			pickBarber: "Ton barbier",
			seeAll: "Tout voir",
			barbers: [
				{
					name: "Yacine",
					initials: "YB",
					specialty: "Dégradés et barbe",
					rating: "4,9",
				},
				{
					name: "Riad",
					initials: "RK",
					specialty: "Coupes classiques",
					rating: "4,8",
				},
			],
			book: "Réserver 14:30",
			price: "800 DA",
			tabs: ["Accueil", "Rendez-vous", "Messages", "Profil"],
		},
		running: {
			club: "Coureurs d'Oran",
			week: "Cette semaine",
			total: "32,4",
			trend: "+12\u00a0%",
			unit: "km",
			goal: "Objectif 40 km",
			dayLetters: ["L", "M", "M", "J", "V", "S", "D"],
			clubRuns: "Sorties du club",
			seeAll: "Tout voir",
			runs: [
				{
					name: "Sara",
					initial: "S",
					when: "Ce matin, Corniche",
					distance: "8,2 km",
					pace: "5:12 /km",
				},
				{
					name: "Lina",
					initial: "L",
					when: "Hier, Canastel",
					distance: "12,0 km",
					pace: "5:48 /km",
				},
				{
					name: "Riad",
					initial: "R",
					when: "Samedi, Santa Cruz",
					distance: "21,1 km",
					pace: "4:56 /km",
				},
			],
			start: "Lancer une course",
			tabs: ["Accueil", "Courses", "Club", "Profil"],
		},
		invoices: {
			nav: ["Tableau de bord", "Factures", "Clients", "Rapports", "Réglages"],
			userName: "Lina Bensalem",
			userRole: "Gérante",
			userInitials: "LB",
			title: "Tableau de bord",
			period: "Octobre 2026",
			search: "Chercher une facture",
			newInvoice: "Nouvelle facture",
			kpis: {
				paid: {
					label: "Payées",
					amount: "48\u00a0200 DA",
					note: "+44\u00a0% ce mois-ci",
				},
				pending: {
					label: "En attente",
					amount: "12\u00a0750 DA",
					note: "6 factures",
				},
				overdue: {
					label: "En retard",
					amount: "3\u00a0400 DA",
					note: "1 facture",
				},
			},
			recent: "Factures récentes",
			viewAll: "Tout voir",
			columns: ["Client", "Facture", "Montant", "Statut"],
			rows: [
				{
					client: "Atelier Riad",
					initials: "AR",
					number: "INV-1042",
					amount: "8\u00a0400 DA",
					status: "paid",
				},
				{
					client: "Sara Haddad",
					initials: "SH",
					number: "INV-1041",
					amount: "3\u00a0200 DA",
					status: "pending",
				},
				{
					client: "Oran Print",
					initials: "OP",
					number: "INV-1040",
					amount: "12\u00a0000 DA",
					status: "paid",
				},
				{
					client: "Café Yacine",
					initials: "CY",
					number: "INV-1039",
					amount: "3\u00a0400 DA",
					status: "overdue",
				},
				{
					client: "Amine Design",
					initials: "AD",
					number: "INV-1038",
					amount: "6\u00a0900 DA",
					status: "paid",
				},
			],
			statuses: { paid: "Payée", pending: "En attente", overdue: "En retard" },
			chartTitle: "Encaissements",
			chartTotal: "198\u00a0400 DA",
			chartNote: "6 derniers mois",
			months: ["Mai", "Juin", "Juil", "Août", "Sept", "Oct"],
		},
		yoga: {
			links: ["Cours", "Profs", "Tarifs", "Contact"],
			book: "Réserver un cours",
			eyebrow: "Studio de yoga à Oran",
			headline: "Respire lentement. Bouge avec le soleil.",
			body: "Flow du matin, yin et prénatal, dans un studio lumineux face à la mer.",
			schedule: "Voir le planning",
			nextLabel: "Prochain cours",
			nextClass: "Flow du lever",
			nextMeta: "07:30, 4 places libres",
			weekTitle: "Cette semaine",
			classes: [
				{
					day: "Lun",
					time: "07:30",
					name: "Flow du lever",
					teacher: "avec Lina",
				},
				{ day: "Mar", time: "18:30", name: "Yin yoga", teacher: "avec Sara" },
				{
					day: "Mer",
					time: "12:15",
					name: "Flow de midi",
					teacher: "avec Amine",
				},
				{ day: "Jeu", time: "19:00", name: "Prénatal", teacher: "avec Lina" },
				{
					day: "Sam",
					time: "09:00",
					name: "Flow plage",
					teacher: "avec Sara",
				},
			],
		},
	},
	ar: {
		barber: {
			greeting: "مساء الخير، أمين",
			clientInitials: "أ",
			pickDay: "اختر اليوم",
			month: "أكتوبر",
			weekdays: ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"],
			pickTime: "اختر الوقت",
			freeSlots: "5 مواعيد شاغرة",
			pickBarber: "اختر حلّاقك",
			seeAll: "عرض الكل",
			barbers: [
				{
					name: "ياسين",
					initials: "ي",
					specialty: "تدريج ولحية",
					rating: "4.9",
				},
				{
					name: "رياض",
					initials: "ر",
					specialty: "قصّات كلاسيكية",
					rating: "4.8",
				},
			],
			book: "احجز 14:30",
			price: "800 دج",
			tabs: ["الرئيسية", "حجوزاتي", "الرسائل", "حسابي"],
		},
		running: {
			club: "عدّاؤو وهران",
			week: "هذا الأسبوع",
			total: "32.4",
			trend: "+12%",
			unit: "كم",
			goal: "الهدف 40 كم",
			dayLetters: ["ن", "ث", "ر", "خ", "ج", "س", "ح"],
			clubRuns: "جولات النادي",
			seeAll: "عرض الكل",
			runs: [
				{
					name: "سارة",
					initial: "س",
					when: "هذا الصباح، الكورنيش",
					distance: "8.2 كم",
					pace: "5:12 لكل كم",
				},
				{
					name: "لينا",
					initial: "ل",
					when: "أمس، كناستيل",
					distance: "12.0 كم",
					pace: "5:48 لكل كم",
				},
				{
					name: "رياض",
					initial: "ر",
					when: "السبت، سانتا كروز",
					distance: "21.1 كم",
					pace: "4:56 لكل كم",
				},
			],
			start: "ابدأ الجري",
			tabs: ["الرئيسية", "جولاتي", "النادي", "حسابي"],
		},
		invoices: {
			nav: ["لوحة التحكم", "الفواتير", "العملاء", "التقارير", "الإعدادات"],
			userName: "لينا بن سالم",
			userRole: "المالكة",
			userInitials: "ل",
			title: "لوحة التحكم",
			period: "أكتوبر 2026",
			search: "ابحث عن فاتورة",
			newInvoice: "فاتورة جديدة",
			kpis: {
				paid: {
					label: "مدفوعة",
					amount: "48\u00a0200 دج",
					note: "زيادة 44% هذا الشهر",
				},
				pending: {
					label: "معلّقة",
					amount: "12\u00a0750 دج",
					note: "6 فواتير",
				},
				overdue: {
					label: "متأخرة",
					amount: "3\u00a0400 دج",
					note: "فاتورة واحدة",
				},
			},
			recent: "آخر الفواتير",
			viewAll: "عرض الكل",
			columns: ["العميل", "الرقم", "المبلغ", "الحالة"],
			rows: [
				{
					client: "ورشة رياض",
					initials: "ر",
					number: "INV-1042",
					amount: "8\u00a0400 دج",
					status: "paid",
				},
				{
					client: "سارة حداد",
					initials: "س",
					number: "INV-1041",
					amount: "3\u00a0200 دج",
					status: "pending",
				},
				{
					client: "مطبعة وهران",
					initials: "م",
					number: "INV-1040",
					amount: "12\u00a0000 دج",
					status: "paid",
				},
				{
					client: "مقهى ياسين",
					initials: "ي",
					number: "INV-1039",
					amount: "3\u00a0400 دج",
					status: "overdue",
				},
				{
					client: "أمين للتصميم",
					initials: "أ",
					number: "INV-1038",
					amount: "6\u00a0900 دج",
					status: "paid",
				},
			],
			statuses: { paid: "مدفوعة", pending: "معلّقة", overdue: "متأخرة" },
			chartTitle: "المداخيل",
			chartTotal: "198\u00a0400 دج",
			chartNote: "آخر 6 أشهر",
			months: ["ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر"],
		},
		yoga: {
			links: ["الحصص", "المدرّبات", "الأسعار", "تواصل معنا"],
			book: "احجز حصة",
			eyebrow: "استوديو يوغا في وهران",
			headline: "تنفّس ببطء، وتحرّك مع الشمس.",
			body: "حصص الصباح الباكر واليين ويوغا الحوامل، في استوديو مشرق مطلّ على البحر.",
			schedule: "شاهد الجدول",
			nextLabel: "الحصة القادمة",
			nextClass: "تدفّق الشروق",
			nextMeta: "07:30، بقيت 4 أماكن",
			weekTitle: "هذا الأسبوع",
			classes: [
				{
					day: "الإثنين",
					time: "07:30",
					name: "تدفّق الشروق",
					teacher: "مع لينا",
				},
				{
					day: "الثلاثاء",
					time: "18:30",
					name: "يين يوغا",
					teacher: "مع سارة",
				},
				{
					day: "الأربعاء",
					time: "12:15",
					name: "تدفّق الظهيرة",
					teacher: "مع أمين",
				},
				{
					day: "الخميس",
					time: "19:00",
					name: "يوغا الحوامل",
					teacher: "مع لينا",
				},
				{
					day: "السبت",
					time: "09:00",
					name: "يوغا الشاطئ",
					teacher: "مع سارة",
				},
			],
		},
	},
} as const satisfies Record<Locale, MiniAppCopy>;
