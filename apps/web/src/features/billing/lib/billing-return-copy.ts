/**
 * Text of the pages where a buyer comes back from Stripe or SlickPay, in en, fr, and ar.
 * The billing success, cancel, and SlickPay return pages read it.
 */
import type { Locale } from "@wandit/internationalization";

/** Texts of the return pages. `received` is the neutral text of a payment that the page cannot confirm yet. */
export type BillingReturnCopy = {
	backToBilling: string;
	backToDashboard: string;
	openProject: string;
	cancel: {
		body: string;
		title: string;
	};
	invalid: {
		body: string;
		title: string;
	};
	order: {
		canceledBody: string;
		canceledTitle: string;
		failedBody: string;
		failedTitle: string;
		fulfilledBody: string;
		fulfilledTitle: string;
		orderLabel: string;
		paidBody: string;
		paidTitle: string;
		pendingBody: string;
		pendingTitle: string;
		queryErrorBody: string;
		queryErrorTitle: string;
		reconcileErrorBody: string;
		reconcileErrorTitle: string;
		reconcilingBody: string;
		reconcilingTitle: string;
		refundPendingBody: string;
		refundPendingTitle: string;
		refundProblemBody: string;
		refundProblemTitle: string;
		refundStatusLabel: string;
		refundedBody: string;
		refundedTitle: string;
		statusLabel: string;
		timeoutBody: string;
		timeoutTitle: string;
	};
	received: {
		body: string;
		title: string;
	};
	retry: string;
	/** SlickPay return page. One title and body per payment state. */
	slickpay: {
		amountLabel: string;
		checkingBody: string;
		checkingTitle: string;
		errorBody: string;
		errorTitle: string;
		expiredBody: string;
		expiredTitle: string;
		failedBody: string;
		failedTitle: string;
		fulfilledBody: string;
		fulfilledTitle: string;
		paidBody: string;
		paidTitle: string;
		/** Label of the amount (v8 row) or the old plan (row from before v8). */
		purchaseLabel: string;
		creditsLabel: string;
		timeoutBody: string;
		timeoutTitle: string;
	};
	/** Stripe top-up return page. The page polls the top-up status, then stops after a fixed time. */
	topup: {
		checkingBody: string;
		checkingTitle: string;
		creditedBody: string;
		creditedTitle: string;
		errorBody: string;
		errorTitle: string;
		timeoutBody: string;
		timeoutTitle: string;
	};
};

const billingReturnCopy = {
	en: {
		backToBilling: "Back to wallet",
		backToDashboard: "Go to dashboard",
		openProject: "Open project",
		cancel: {
			body: "Nothing was charged. You can return to Wandit whenever you are ready.",
			title: "Checkout canceled",
		},
		invalid: {
			body: "This checkout return link is incomplete or no longer valid.",
			title: "We could not verify this checkout",
		},
		order: {
			canceledBody:
				"This order was canceled before it could be completed. No further setup will run.",
			canceledTitle: "Order canceled",
			failedBody:
				"Payment or registration could not be completed. No further setup will run for this order.",
			failedTitle: "Order failed",
			fulfilledBody:
				"Your domain was registered and connected. It is ready to use.",
			fulfilledTitle: "Your domain is ready",
			orderLabel: "Order",
			paidBody:
				"Payment is confirmed. Your domain is entering the registration queue.",
			paidTitle: "Payment confirmed",
			pendingBody:
				"Stripe returned you safely. We are waiting for the payment confirmation.",
			pendingTitle: "Checking your payment",
			queryErrorBody:
				"We could not load the latest order status. Your payment record is safe; try checking again.",
			queryErrorTitle: "Could not refresh the order",
			reconcileErrorBody:
				"We could not verify the Stripe session. Try again before leaving this page.",
			reconcileErrorTitle: "Could not verify the payment",
			reconcilingBody:
				"We are matching this Stripe session with your Wandit order.",
			reconcilingTitle: "Verifying your payment",
			refundPendingBody:
				"Registration did not complete. Your refund is pending, and some payment methods may require an additional step.",
			refundPendingTitle: "Refund in progress",
			refundProblemBody:
				"Registration did not complete, and the refund needs attention. Keep this order ID if you contact support.",
			refundProblemTitle: "Refund needs attention",
			refundStatusLabel: "Refund status",
			refundedBody:
				"The registration could not be completed, and the payment has been refunded.",
			refundedTitle: "Payment refunded",
			statusLabel: "Status",
			timeoutBody:
				"We could not confirm a final status yet. Keep this order ID and check the order again later.",
			timeoutTitle: "Status is still pending",
		},
		received: {
			body: "Thank you. The credits appear in your wallet within a few minutes. You do not need to pay again.",
			title: "Payment received",
		},
		retry: "Try again",
		slickpay: {
			amountLabel: "Amount",
			checkingBody:
				"We are checking your CIB / Edahabia payment with SlickPay. Keep this page open.",
			checkingTitle: "Checking your payment",
			errorBody:
				"We could not check this payment. If you paid, your credits appear within a few minutes. You do not need to pay again.",
			errorTitle: "Could not check the payment",
			expiredBody:
				"SlickPay did not receive a payment for this invoice. You were not charged. Start a new payment from the wallet page.",
			expiredTitle: "Payment not completed",
			failedBody:
				"SlickPay did not start this payment. You were not charged. Try again from the wallet page.",
			failedTitle: "Payment did not start",
			fulfilledBody:
				"We received your payment. The credits are in your wallet.",
			fulfilledTitle: "Credits added",
			paidBody: "SlickPay confirmed your payment. We are adding your credits.",
			paidTitle: "Payment received",
			purchaseLabel: "Purchase",
			creditsLabel: "Credits",
			timeoutBody:
				"We are still confirming your payment. Your credits appear within a few minutes. You do not need to pay again.",
			timeoutTitle: "Still confirming your payment",
		},
		topup: {
			checkingBody:
				"We are waiting for Stripe to confirm your payment. Keep this page open.",
			checkingTitle: "Checking your payment",
			creditedBody:
				"Your payment is confirmed. The credits are in your wallet.",
			creditedTitle: "Credits added",
			errorBody:
				"We could not check this payment. If you paid, the credits appear within a few minutes. You do not need to pay again.",
			errorTitle: "Could not check the payment",
			timeoutBody:
				"The confirmation can take a few more minutes. The credits appear in your wallet when Stripe confirms the payment. You do not need to pay again.",
			timeoutTitle: "Still confirming your payment",
		},
	},
	fr: {
		backToBilling: "Retour au portefeuille",
		backToDashboard: "Accéder au tableau de bord",
		openProject: "Ouvrir le projet",
		cancel: {
			body: "Aucun montant n’a été débité. Vous pourrez reprendre quand vous serez prêt.",
			title: "Paiement annulé",
		},
		invalid: {
			body: "Ce lien de retour est incomplet ou n’est plus valide.",
			title: "Impossible de vérifier ce paiement",
		},
		order: {
			canceledBody:
				"Cette commande a été annulée avant sa finalisation. Aucune autre configuration ne sera lancée.",
			canceledTitle: "Commande annulée",
			failedBody:
				"Le paiement ou l’enregistrement n’a pas abouti. Aucune autre configuration ne sera lancée pour cette commande.",
			failedTitle: "Échec de la commande",
			fulfilledBody:
				"Votre domaine a été enregistré et connecté. Il est prêt à être utilisé.",
			fulfilledTitle: "Votre domaine est prêt",
			orderLabel: "Commande",
			paidBody:
				"Le paiement est confirmé. Votre domaine entre dans la file d’enregistrement.",
			paidTitle: "Paiement confirmé",
			pendingBody:
				"Votre retour depuis Stripe est sécurisé. Nous attendons la confirmation du paiement.",
			pendingTitle: "Vérification du paiement",
			queryErrorBody:
				"Impossible de charger le dernier état de la commande. Votre paiement reste enregistré ; réessayez.",
			queryErrorTitle: "Impossible d’actualiser la commande",
			reconcileErrorBody:
				"Impossible de vérifier la session Stripe. Réessayez avant de quitter cette page.",
			reconcileErrorTitle: "Impossible de vérifier le paiement",
			reconcilingBody:
				"Nous associons cette session Stripe à votre commande Wandit.",
			reconcilingTitle: "Vérification de votre paiement",
			refundPendingBody:
				"L’enregistrement n’a pas abouti. Votre remboursement est en attente et certains moyens de paiement peuvent nécessiter une étape supplémentaire.",
			refundPendingTitle: "Remboursement en cours",
			refundProblemBody:
				"L’enregistrement n’a pas abouti et le remboursement nécessite une intervention. Conservez cet identifiant de commande pour contacter l’assistance.",
			refundProblemTitle: "Remboursement à vérifier",
			refundStatusLabel: "État du remboursement",
			refundedBody:
				"L’enregistrement n’a pas pu aboutir et le paiement a été remboursé.",
			refundedTitle: "Paiement remboursé",
			statusLabel: "État",
			timeoutBody:
				"Nous n’avons pas encore pu confirmer un état final. Conservez cet identifiant et consultez de nouveau la commande plus tard.",
			timeoutTitle: "État toujours en attente",
		},
		received: {
			body: "Merci. Les crédits arrivent dans votre portefeuille d’ici quelques minutes. Vous n’avez pas besoin de payer à nouveau.",
			title: "Paiement reçu",
		},
		retry: "Réessayer",
		slickpay: {
			amountLabel: "Montant",
			checkingBody:
				"Nous vérifions votre paiement CIB / Edahabia auprès de SlickPay. Gardez cette page ouverte.",
			checkingTitle: "Vérification du paiement",
			errorBody:
				"Impossible de vérifier ce paiement. Si vous avez payé, vos crédits arrivent dans quelques minutes. Vous n’avez pas besoin de payer à nouveau.",
			errorTitle: "Impossible de vérifier le paiement",
			expiredBody:
				"SlickPay n’a reçu aucun paiement pour cette facture. Aucun montant n’a été débité. Lancez un nouveau paiement depuis la page du portefeuille.",
			expiredTitle: "Paiement non effectué",
			failedBody:
				"SlickPay n’a pas pu démarrer ce paiement. Aucun montant n’a été débité. Réessayez depuis la page du portefeuille.",
			failedTitle: "Le paiement n’a pas démarré",
			fulfilledBody:
				"Nous avons reçu votre paiement. Les crédits sont dans votre portefeuille.",
			fulfilledTitle: "Crédits ajoutés",
			paidBody:
				"SlickPay a confirmé votre paiement. Nous ajoutons vos crédits.",
			paidTitle: "Paiement reçu",
			purchaseLabel: "Achat",
			creditsLabel: "Crédits",
			timeoutBody:
				"Nous confirmons encore votre paiement. Vos crédits arrivent dans quelques minutes. Vous n’avez pas besoin de payer à nouveau.",
			timeoutTitle: "Confirmation toujours en cours",
		},
		topup: {
			checkingBody:
				"Nous attendons la confirmation de Stripe. Gardez cette page ouverte.",
			checkingTitle: "Vérification du paiement",
			creditedBody:
				"Votre paiement est confirmé. Les crédits sont dans votre portefeuille.",
			creditedTitle: "Crédits ajoutés",
			errorBody:
				"Impossible de vérifier ce paiement. Si vous avez payé, les crédits arrivent dans quelques minutes. Vous n’avez pas besoin de payer à nouveau.",
			errorTitle: "Impossible de vérifier le paiement",
			timeoutBody:
				"La confirmation peut prendre encore quelques minutes. Les crédits arrivent dans votre portefeuille dès que Stripe confirme le paiement. Vous n’avez pas besoin de payer à nouveau.",
			timeoutTitle: "Confirmation toujours en cours",
		},
	},
	ar: {
		backToBilling: "العودة إلى المحفظة",
		backToDashboard: "الانتقال إلى لوحة التحكم",
		openProject: "فتح المشروع",
		cancel: {
			body: "لم يتم خصم أي مبلغ. يمكنك العودة إلى Wandit عندما تكون مستعدًا.",
			title: "تم إلغاء الدفع",
		},
		invalid: {
			body: "رابط العودة من الدفع غير مكتمل أو لم يعد صالحًا.",
			title: "تعذر التحقق من عملية الدفع",
		},
		order: {
			canceledBody:
				"تم إلغاء هذا الطلب قبل اكتماله، ولن تبدأ أي خطوات إعداد إضافية.",
			canceledTitle: "تم إلغاء الطلب",
			failedBody:
				"تعذر إكمال الدفع أو تسجيل النطاق، ولن تبدأ أي خطوات إعداد إضافية لهذا الطلب.",
			failedTitle: "تعذر إكمال الطلب",
			fulfilledBody: "تم تسجيل نطاقك وربطه، وأصبح جاهزًا للاستخدام.",
			fulfilledTitle: "نطاقك جاهز",
			orderLabel: "الطلب",
			paidBody: "تم تأكيد الدفع، وسيدخل نطاقك الآن في قائمة التسجيل.",
			paidTitle: "تم تأكيد الدفع",
			pendingBody: "عدت من Stripe بأمان. ننتظر الآن تأكيد عملية الدفع.",
			pendingTitle: "جارٍ التحقق من الدفع",
			queryErrorBody:
				"تعذر تحميل أحدث حالة للطلب. سجل الدفع محفوظ؛ حاول التحقق مرة أخرى.",
			queryErrorTitle: "تعذر تحديث الطلب",
			reconcileErrorBody:
				"تعذر التحقق من جلسة Stripe. حاول مرة أخرى قبل مغادرة الصفحة.",
			reconcileErrorTitle: "تعذر التحقق من الدفع",
			reconcilingBody: "نطابق جلسة Stripe هذه مع طلبك في Wandit.",
			reconcilingTitle: "جارٍ التحقق من الدفع",
			refundPendingBody:
				"لم يكتمل تسجيل النطاق. رد المبلغ قيد الانتظار، وقد تتطلب بعض طرق الدفع خطوة إضافية.",
			refundPendingTitle: "رد المبلغ قيد التنفيذ",
			refundProblemBody:
				"لم يكتمل تسجيل النطاق، ويحتاج رد المبلغ إلى المتابعة. احتفظ بمعرّف الطلب إذا تواصلت مع الدعم.",
			refundProblemTitle: "رد المبلغ يحتاج إلى متابعة",
			refundStatusLabel: "حالة رد المبلغ",
			refundedBody: "تعذر إكمال التسجيل، وتم رد مبلغ الدفع.",
			refundedTitle: "تم رد المبلغ",
			statusLabel: "الحالة",
			timeoutBody:
				"لم نتمكن بعد من تأكيد الحالة النهائية. احتفظ بمعرّف الطلب وتحقق من حالته لاحقًا.",
			timeoutTitle: "الحالة ما زالت قيد الانتظار",
		},
		received: {
			body: "شكرًا لك. ستصل الأرصدة إلى محفظتك خلال دقائق. لا حاجة إلى الدفع مرة أخرى.",
			title: "تم استلام الدفع",
		},
		retry: "حاول مرة أخرى",
		slickpay: {
			amountLabel: "المبلغ",
			checkingBody:
				"نتحقق من دفعك عبر CIB / Edahabia لدى SlickPay. أبقِ هذه الصفحة مفتوحة.",
			checkingTitle: "جارٍ التحقق من الدفع",
			errorBody:
				"تعذر التحقق من هذا الدفع. إذا دفعت، فستصل أرصدتك خلال دقائق. لا حاجة إلى الدفع مرة أخرى.",
			errorTitle: "تعذر التحقق من الدفع",
			expiredBody:
				"لم يستلم SlickPay أي دفع لهذه الفاتورة، ولم يتم خصم أي مبلغ. ابدأ دفعًا جديدًا من صفحة المحفظة.",
			expiredTitle: "لم يكتمل الدفع",
			failedBody:
				"تعذر على SlickPay بدء هذا الدفع، ولم يتم خصم أي مبلغ. حاول مرة أخرى من صفحة المحفظة.",
			failedTitle: "لم يبدأ الدفع",
			fulfilledBody: "استلمنا دفعك. الأرصدة الآن في محفظتك.",
			fulfilledTitle: "تمت إضافة الأرصدة",
			paidBody: "أكد SlickPay دفعك. نضيف أرصدتك الآن.",
			paidTitle: "تم استلام الدفع",
			purchaseLabel: "الشراء",
			creditsLabel: "الأرصدة",
			timeoutBody:
				"ما زلنا نؤكد دفعك. ستصل أرصدتك خلال دقائق. لا حاجة إلى الدفع مرة أخرى.",
			timeoutTitle: "ما زلنا نؤكد دفعك",
		},
		topup: {
			checkingBody: "ننتظر تأكيد Stripe لدفعك. أبقِ هذه الصفحة مفتوحة.",
			checkingTitle: "جارٍ التحقق من الدفع",
			creditedBody: "تم تأكيد دفعك. الأرصدة الآن في محفظتك.",
			creditedTitle: "تمت إضافة الأرصدة",
			errorBody:
				"تعذر التحقق من هذا الدفع. إذا دفعت، فستصل الأرصدة خلال دقائق. لا حاجة إلى الدفع مرة أخرى.",
			errorTitle: "تعذر التحقق من الدفع",
			timeoutBody:
				"قد يستغرق التأكيد بضع دقائق أخرى. ستصل الأرصدة إلى محفظتك عندما يؤكد Stripe الدفع. لا حاجة إلى الدفع مرة أخرى.",
			timeoutTitle: "ما زلنا نؤكد دفعك",
		},
	},
} as const satisfies Record<Locale, BillingReturnCopy>;

export function getBillingReturnCopy(locale: Locale): BillingReturnCopy {
	return billingReturnCopy[locale];
}
