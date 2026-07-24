import type { Locale } from "@wandit/internationalization";

export type BillingReturnCopy = {
	backToDashboard: string;
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
	retry: string;
	subscription: {
		creditsLabel: string;
		fixPaymentLabel: string;
		notFoundBody: string;
		notFoundTitle: string;
		paymentAttentionBody: string;
		paymentAttentionTitle: string;
		planLabel: string;
		syncErrorBody: string;
		syncErrorTitle: string;
		syncingBody: string;
		syncingTitle: string;
		updatedBody: string;
		updatedTitle: string;
	};
	topup: {
		updatedBody: string;
		updatedTitle: string;
	};
};

const billingReturnCopy = {
	en: {
		backToDashboard: "Go to dashboard",
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
		retry: "Try again",
		subscription: {
			creditsLabel: "Current credit balance",
			fixPaymentLabel: "Fix payment",
			notFoundBody:
				"Stripe returned successfully, but an active subscription is not visible yet. Try syncing again in a moment.",
			notFoundTitle: "Subscription still updating",
			paymentAttentionBody:
				"Your subscription is visible, but payment needs attention before plan access can continue. Open the billing portal to fix it.",
			paymentAttentionTitle: "Payment needs attention",
			planLabel: "Plan",
			syncErrorBody:
				"We could not refresh your subscription from Stripe. Try again before leaving this page.",
			syncErrorTitle: "Could not update the subscription",
			syncingBody:
				"We are refreshing your plan directly from Stripe. This usually takes only a moment.",
			syncingTitle: "Updating your subscription",
			updatedBody:
				"Your plan is now reflected in Wandit. Included credits may take a moment to appear while Stripe finalizes the update.",
			updatedTitle: "Subscription updated",
		},
		topup: {
			updatedBody:
				"Stripe received your checkout. Your credit balance will update after the payment is confirmed.",
			updatedTitle: "Top-up submitted",
		},
	},
	fr: {
		backToDashboard: "Accéder au tableau de bord",
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
		retry: "Réessayer",
		subscription: {
			creditsLabel: "Solde de crédits actuel",
			fixPaymentLabel: "Corriger le paiement",
			notFoundBody:
				"Le retour Stripe a réussi, mais aucun abonnement actif n’est encore visible. Relancez la synchronisation dans un instant.",
			notFoundTitle: "Mise à jour de l’abonnement",
			paymentAttentionBody:
				"Votre abonnement est visible, mais le paiement doit être corrigé avant de rétablir l’accès à l’offre. Ouvrez le portail de facturation.",
			paymentAttentionTitle: "Paiement à corriger",
			planLabel: "Offre",
			syncErrorBody:
				"Impossible d’actualiser votre abonnement depuis Stripe. Réessayez avant de quitter cette page.",
			syncErrorTitle: "Impossible d’actualiser l’abonnement",
			syncingBody:
				"Nous actualisons votre offre directement depuis Stripe. Cela ne prend généralement qu’un instant.",
			syncingTitle: "Mise à jour de votre abonnement",
			updatedBody:
				"Votre offre est maintenant à jour dans Wandit. Les crédits inclus peuvent prendre quelques instants avant d’apparaître pendant que Stripe finalise la mise à jour.",
			updatedTitle: "Abonnement mis à jour",
		},
		topup: {
			updatedBody:
				"Stripe a reçu votre demande de paiement. Votre solde de crédits sera mis à jour après confirmation.",
			updatedTitle: "Recharge envoyée",
		},
	},
	ar: {
		backToDashboard: "الانتقال إلى لوحة التحكم",
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
		retry: "حاول مرة أخرى",
		subscription: {
			creditsLabel: "رصيد الأرصدة الحالي",
			fixPaymentLabel: "إصلاح الدفع",
			notFoundBody:
				"اكتملت العودة من Stripe، لكن الاشتراك النشط لم يظهر بعد. أعد المزامنة بعد لحظات.",
			notFoundTitle: "الاشتراك قيد التحديث",
			paymentAttentionBody:
				"اشتراكك ظاهر، لكن يجب معالجة الدفع قبل استعادة مزايا الخطة. افتح بوابة الفوترة لإصلاحه.",
			paymentAttentionTitle: "الدفع يحتاج إلى متابعة",
			planLabel: "الخطة",
			syncErrorBody:
				"تعذر تحديث اشتراكك من Stripe. حاول مرة أخرى قبل مغادرة الصفحة.",
			syncErrorTitle: "تعذر تحديث الاشتراك",
			syncingBody: "نحدّث خطتك مباشرة من Stripe. يستغرق ذلك عادة لحظات فقط.",
			syncingTitle: "جارٍ تحديث اشتراكك",
			updatedBody:
				"أصبحت خطتك محدّثة في Wandit. قد تستغرق الأرصدة المضمّنة لحظات للظهور ريثما يُكمل Stripe تحديث الاشتراك.",
			updatedTitle: "تم تحديث الاشتراك",
		},
		topup: {
			updatedBody: "استلم Stripe طلب الدفع. سيُحدَّث رصيدك بعد تأكيد عملية الدفع.",
			updatedTitle: "تم إرسال طلب شحن الرصيد",
		},
	},
} as const satisfies Record<Locale, BillingReturnCopy>;

export function getBillingReturnCopy(locale: Locale): BillingReturnCopy {
	return billingReturnCopy[locale];
}
