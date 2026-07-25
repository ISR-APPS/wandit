import { describe, expect, it } from "vitest";

import { getBillingReturnCopy } from "./billing-return-copy";

describe("billing return copy", () => {
	it.each([
		[
			"en",
			"Your plan is now reflected in Wandit. Included credits may take a moment to appear while Stripe finalizes the update.",
			"We could not confirm a final status yet. Keep this order ID and check the order again later.",
		],
		[
			"fr",
			"Votre offre est maintenant à jour dans Wandit. Les crédits inclus peuvent prendre quelques instants avant d’apparaître pendant que Stripe finalise la mise à jour.",
			"Nous n’avons pas encore pu confirmer un état final. Conservez cet identifiant et consultez de nouveau la commande plus tard.",
		],
		[
			"ar",
			"أصبحت خطتك محدّثة في Wandit. قد تستغرق الأرصدة المضمّنة لحظات للظهور ريثما يُكمل Stripe تحديث الاشتراك.",
			"لم نتمكن بعد من تأكيد الحالة النهائية. احتفظ بمعرّف الطلب وتحقق من حالته لاحقًا.",
		],
	] as const)("keeps %s subscription grants and order timeouts truthful", (locale, subscriptionBody, timeoutBody) => {
		const copy = getBillingReturnCopy(locale);

		expect(copy.subscription.updatedBody).toBe(subscriptionBody);
		expect(copy.subscription.paymentAttentionBody).not.toHaveLength(0);
		expect(copy.subscription.paymentAttentionTitle).not.toHaveLength(0);
		expect(copy.subscription.fixPaymentLabel).not.toHaveLength(0);
		expect(copy.order.timeoutBody).toBe(timeoutBody);
		expect(copy.order.refundPendingBody).not.toHaveLength(0);
		expect(copy.order.refundProblemBody).not.toHaveLength(0);
		expect(copy.order.refundStatusLabel).not.toHaveLength(0);
	});
});
