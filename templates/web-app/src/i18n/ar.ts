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
		subtitle: "استخدم بريدك الإلكتروني وكلمة المرور.",
		signUpTitle: "إنشاء حساب",
		signUpSubtitle: "يعمل حسابك فوراً.",
		email: "البريد الإلكتروني",
		emailPlaceholder: "you@example.com",
		password: "كلمة المرور",
		confirmPassword: "تأكيد كلمة المرور",
		submit: "تسجيل الدخول",
		signUpSubmit: "إنشاء الحساب",
		sending: "لحظة…",
		toSignUp: "ليس لديك حساب؟ أنشئ حساباً",
		toSignIn: "لديك حساب؟ سجّل الدخول",
		passwordMismatch: "كلمتا المرور غير متطابقتين.",
		error: "فشل تسجيل الدخول. تحقق من بريدك الإلكتروني وكلمة المرور.",
		signUpError:
			"فشل إنشاء الحساب. حاول مرة أخرى، أو سجّل الدخول إذا كان لديك حساب.",
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
