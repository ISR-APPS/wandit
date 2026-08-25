import { Inject, Injectable, Logger } from "@nestjs/common";

import { EmailService } from "../../../email/application/services/email.service";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import {
	DONE_EVENT_MAPPING,
	FREE_ONLY_EVENTS,
	type LifecycleEventName,
} from "../../domain/lifecycle-event";
import {
	type LifecycleDispatchContext,
	type LifecycleEventRow,
	LifecycleEventsRepository,
} from "../../infrastructure/persistence/lifecycle-events.repository";

const DEFAULT_SWEEP_LIMIT = 100;
const LAST_ERROR_MAX_LENGTH = 2_000;

const FREE_ONLY_EVENT_SET = new Set<LifecycleEventName>(FREE_ONLY_EVENTS);

type DoneEventRule = {
	doneEvent: LifecycleEventName;
	payloadKey: `done_${string}`;
};

const DONE_EVENT_RULES = DONE_EVENT_MAPPING as Readonly<
	Partial<Record<LifecycleEventName, DoneEventRule>>
>;

const COMPUTED_PAYLOAD_KEYS = [
	"first_name",
	"plan",
	"skip_activation",
	...Object.values(DONE_EVENT_MAPPING).map((rule) => rule.payloadKey),
] as const;

type DispatcherRepository = Pick<
	LifecycleEventsRepository,
	| "listDue"
	| "healMissingSignupEvents"
	| "loadDispatchContext"
	| "markDispatched"
	| "markDropped"
	| "markFailed"
>;

type DispatcherSettings = Pick<ProductSettingsService, "get">;
type DispatcherEmail = Pick<EmailService, "sendLifecycleEvent">;

export type LifecycleSweepResult = {
	dispatched: number;
	dropped: number;
	failed: number;
};

export type LifecycleDispatchOutcome = keyof LifecycleSweepResult;

@Injectable()
export class LifecycleEventsDispatcher {
	private readonly logger = new Logger(LifecycleEventsDispatcher.name);

	constructor(
		@Inject(LifecycleEventsRepository)
		private readonly repository: DispatcherRepository,
		@Inject(ProductSettingsService)
		private readonly settings: DispatcherSettings,
		@Inject(EmailService)
		private readonly email: DispatcherEmail,
	) {}

	async sweep(limit = DEFAULT_SWEEP_LIMIT): Promise<LifecycleSweepResult> {
		await this.repository.healMissingSignupEvents();
		const rows = await this.repository.listDue(limit);
		const result: LifecycleSweepResult = {
			dispatched: 0,
			dropped: 0,
			failed: 0,
		};

		for (const row of rows) {
			const outcome = await this.dispatch(row);
			result[outcome] += 1;
		}

		return result;
	}

	async dispatch(row: LifecycleEventRow): Promise<LifecycleDispatchOutcome> {
		if (row.dispatchedAt) {
			return "dispatched";
		}

		if (row.droppedAt) {
			return "dropped";
		}

		try {
			const settings = await this.settings.get();

			if (!settings.lifecycleEmailsEnabled) {
				await this.repository.markDropped(row.id, "disabled");
				return "dropped";
			}

			const context = await this.repository.loadDispatchContext(row.userId);
			const email = context?.user.email.trim() ?? "";

			if (!context || email.length === 0) {
				await this.repository.markDropped(row.id, "no_email");
				return "dropped";
			}

			if (FREE_ONLY_EVENT_SET.has(row.event) && !isMonetizationFree(context)) {
				await this.repository.markDropped(row.id, "not_free");
				return "dropped";
			}

			await this.email.sendLifecycleEvent({
				email,
				event: row.event,
				payload: buildPayload(row, context),
			});
			await this.repository.markDispatched(row.id);

			return "dispatched";
		} catch (error) {
			const message = errorMessage(error).slice(0, LAST_ERROR_MAX_LENGTH);
			await this.repository.markFailed(row.id, message);
			this.logger.error(
				`lifecycle_event_dispatch_failed id=${row.id} user=${row.userId} event=${row.event}`,
				message,
			);

			return "failed";
		}
	}
}

function isMonetizationFree(context: LifecycleDispatchContext): boolean {
	return (
		context.entitledSubscription === null &&
		!context.hasPersonalTopupReceipt &&
		!context.hasOpenPersonalManualRequest
	);
}

function buildPayload(
	row: LifecycleEventRow,
	context: LifecycleDispatchContext,
): Record<string, unknown> {
	const payload: Record<string, unknown> = { ...row.payload };

	for (const key of COMPUTED_PAYLOAD_KEYS) {
		delete payload[key];
	}

	payload.plan = context.entitledSubscription?.plan ?? "free";

	const firstName = context.user.name.trim().split(/\s+/u)[0] ?? "";

	if (firstName.length > 0) {
		payload.first_name = firstName;
	}

	if (row.event === "signup_completed") {
		payload.skip_activation =
			context.hasFirstPromptEvent || context.acceptedInvitation;
	}

	const doneRule = DONE_EVENT_RULES[row.event];

	if (doneRule) {
		payload[doneRule.payloadKey] = context.capturedEvents.includes(
			doneRule.doneEvent,
		);
	}

	return payload;
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	return String(error);
}
