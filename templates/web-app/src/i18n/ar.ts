// Arabic dictionary. Modern Standard Arabic, right-to-left, no italics.
// Must keep the same keys and the same tree shape as en.ts.
import type { Dictionary } from "./translate";

export const ar: Dictionary = {
	common: {
		appName: "تطبيق وانديت",
		save: "حفظ",
		signOut: "تسجيل الخروج",
	},
	nav: {
		features: "المميزات",
		signIn: "تسجيل الدخول",
	},
	landing: {
		heroTitle: "نشاطك التجاري على الإنترنت في دقائق",
		heroSubtitle: "واجهة سريعة بثلاث لغات، مع قاعدة بيانات خاصة بها.",
		heroCta: "ابدأ الآن",
		featuresTitle: "كل ما تحتاجه",
		feature1Title: "سريع افتراضياً",
		feature1Body: "صفحات ثابتة تُقدَّم من أقرب نقطة إلى زبائنك.",
		feature2Title: "قاعدة بياناتك الخاصة",
		feature2Body: "لكل تطبيق قاعدة بيانات خاصة به، جاهزة من اليوم الأول.",
		feature3Title: "ثلاث لغات",
		feature3Body:
			"الإنجليزية والفرنسية والعربية مع دعم كامل للكتابة من اليمين إلى اليسار.",
	},
	login: {
		title: "تسجيل الدخول",
		subtitle: "نرسل لك رابطاً سحرياً بالبريد الإلكتروني. لا حاجة لكلمة مرور.",
		email: "البريد الإلكتروني",
		emailPlaceholder: "you@example.com",
		submit: "أرسل الرابط",
		sending: "جارٍ الإرسال…",
		sentTitle: "تحقق من بريدك الإلكتروني",
		sentBody: "افتح الرابط في البريد الإلكتروني لإتمام تسجيل الدخول.",
		error: "فشل تسجيل الدخول. حاول مرة أخرى.",
	},
	app: {
		profileTitle: "الملف الشخصي",
		fullName: "الاسم الكامل",
		fullNamePlaceholder: "اسمك المعروض",
		savedBody: "تم تحديث ملفك الشخصي.",
		loadError: "لم يتم تحميل ملفك الشخصي. حدّث الصفحة.",
		saveError: "لم يتم حفظ ملفك الشخصي. حاول مرة أخرى.",
	},
};
