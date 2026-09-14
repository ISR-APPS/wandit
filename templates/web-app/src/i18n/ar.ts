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
		heroSubtitle:
			"واجهة سريعة مع نموذج طلبات مدمج. زبائنك يتواصلون معك مباشرة.",
		heroCta: "ابدأ الآن",
		featuresTitle: "كل ما تحتاجه",
		feature1Title: "سريع افتراضياً",
		feature1Body: "صفحات ثابتة تُقدَّم من أقرب نقطة إلى زبائنك.",
		feature2Title: "طلبات تصل إليك",
		feature2Body: "كل طلب من النموذج يصل إلى بريد الطلبات فوراً.",
		feature3Title: "ثلاث لغات",
		feature3Body:
			"الإنجليزية والفرنسية والعربية مع دعم كامل للكتابة من اليمين إلى اليسار.",
	},
	lead: {
		title: "اطلب معاودة الاتصال",
		subtitle: "اترك بياناتك وسنتصل بك اليوم.",
		name: "الاسم الكامل",
		namePlaceholder: "اسمك",
		phone: "الهاتف",
		phonePlaceholder: "05 00 00 00 00",
		wilaya: "الولاية",
		wilayaPlaceholder: "الجزائر",
		commune: "البلدية",
		communePlaceholder: "بلديتك",
		product: "المنتج",
		productPlaceholder: "ماذا تريد أن تطلب؟",
		quantity: "الكمية",
		submit: "أرسل الطلب",
		successTitle: "تم استلام الطلب",
		successBody: "شكراً لك. سنتصل بك في أقرب وقت ممكن.",
		errorRequired: "املأ كل الحقول قبل الإرسال.",
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
