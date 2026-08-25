import type { createDb } from "@wandit/db";

import { EmailService } from "../modules/email/application/services/email.service";
import { LifecycleEventsDispatcher } from "../modules/lifecycle-events/application/services/lifecycle-events-dispatcher.service";
import { LifecycleEventsRepository } from "../modules/lifecycle-events/infrastructure/persistence/lifecycle-events.repository";
import { ProductSettingsService } from "../modules/settings/application/services/product-settings.service";
import { ProductSettingsRepository } from "../modules/settings/infrastructure/persistence/product-settings.repository";

type TriggerDatabase = ReturnType<typeof createDb>;

/** Manual composition for Trigger workers, which intentionally do not boot Nest. */
export function createLifecycleEventsRuntime(db: TriggerDatabase) {
	const repository = new LifecycleEventsRepository(db);

	return {
		dispatcher: new LifecycleEventsDispatcher(
			repository,
			new ProductSettingsService(new ProductSettingsRepository(db)),
			new EmailService(),
		),
	};
}
