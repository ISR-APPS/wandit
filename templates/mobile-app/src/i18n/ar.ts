// Arabic dictionary. Modern Standard Arabic, right-to-left, no italics.
// Must keep the same keys and the same tree shape as en.ts.
import type { Dictionary } from "./translate";

export const ar: Dictionary = {
	common: {
		appName: "تطبيقي",
		back: "رجوع",
		retry: "حاول مرة أخرى",
	},
	home: {
		title: "مرحباً",
		subtitle: "يعمل هذا التطبيق على آيفون وأندرويد والويب.",
		languageTitle: "اللغة",
		openProfiles: "افتح قائمة الملفات الشخصية",
	},
	profiles: {
		title: "الملفات الشخصية",
		empty: "لا يوجد ملف شخصي للعرض. يظهر ملفك بعد تسجيل الدخول.",
		loadError: "لم يتم تحميل القائمة.",
		unnamed: "بدون اسم بعد",
	},
};
