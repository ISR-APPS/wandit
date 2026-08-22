/**
 * The public capture flow: anonymous and cross-origin.
 *
 * The page's primary transport posts application/json, while the unload
 * fallback may arrive as a raw text/plain string. Honeypots, inserts, and
 * in-window updates answer the same { ok: true } so bots learn nothing from
 * the response.
 */
import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	type LeadCaptureBody,
	type LeadCaptureResponse,
	leadCaptureBodySchema,
} from "@wandit/contracts";
import { normalizeLeadPhone } from "../../domain/normalize-lead-phone";
import { LeadsRepository } from "../../infrastructure/persistence/leads.repository";
import { LeadsCaptureThrottle } from "./leads-capture-throttle";

// Same phone hitting the same project inside this window dedupes double submits
// (page retries, impatient double click, heuristic + event both firing) by
// updating the recent row in place; no submission is dropped.
const DUPLICATE_WINDOW_MS = 2 * 60_000;

export class LeadsCaptureRateLimitException extends HttpException {
	constructor(public readonly retryAfterSeconds: number) {
		super(
			{
				code: "LEAD_CAPTURE_RATE_LIMITED",
				message: "Too many submissions",
			},
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}

@Injectable()
export class LeadsCaptureService {
	private readonly logger = new Logger(LeadsCaptureService.name);

	constructor(
		@Inject(LeadsRepository)
		private readonly leadsRepository: LeadsRepository,
		@Inject(LeadsCaptureThrottle)
		private readonly throttle: LeadsCaptureThrottle,
	) {}

	async capture(
		publicFormId: string,
		rawBody: unknown,
		ip: string,
	): Promise<LeadCaptureResponse> {
		const project =
			await this.leadsRepository.findProjectByPublicFormId(publicFormId);
		if (!project) {
			throw new NotFoundException("Unknown form");
		}

		const body = this.parseBody(rawBody);

		if (body._hp) {
			this.logger.debug(`Honeypot tripped for project ${project.id}`);
			return { ok: true };
		}

		const phone = normalizeLeadPhone(body.phone);
		if (!phone) {
			throw new BadRequestException("Invalid phone number");
		}

		const throttleDecision = this.throttle.consume(publicFormId, ip);
		if (!throttleDecision.allowed) {
			throw new LeadsCaptureRateLimitException(
				throttleDecision.retryAfterSeconds,
			);
		}

		const loadedDeployment = body.deploymentId
			? await this.leadsRepository.findDeploymentSnapshotById(
					project.id,
					body.deploymentId,
				)
			: null;
		if (body.deploymentId && loadedDeployment === null) {
			this.logger.warn(
				`Lead capture deploymentId ${body.deploymentId} did not resolve for project ${project.id}; falling back to active deployment`,
			);
		}
		// A resolved loaded deployment wins even when its SKU is null; only a
		// missing or foreign id falls back to the currently active deployment.
		const deployment =
			loadedDeployment ??
			(await this.leadsRepository.findActiveDeploymentSnapshot(project.id));

		await this.leadsRepository.upsertCaptureLead(
			{
				attribution: body.attribution ?? null,
				commune: body.commune || null,
				deploymentId: deployment?.deploymentId ?? null,
				// Spec: keep the raw phone as typed; the column only holds E.164.
				extras: { ...body.extras, _rawPhone: body.phone },
				name: body.name,
				phone,
				productSku: deployment?.productSku ?? null,
				projectId: project.id,
				wilaya: body.wilaya || null,
			},
			new Date(Date.now() - DUPLICATE_WINDOW_MS),
		);

		return { ok: true };
	}

	private parseBody(rawBody: unknown): LeadCaptureBody {
		let candidate = rawBody;
		if (typeof candidate === "string") {
			try {
				candidate = JSON.parse(candidate);
			} catch {
				throw new BadRequestException("Malformed capture payload");
			}
		}

		const parsed = leadCaptureBodySchema.safeParse(candidate);
		if (!parsed.success) {
			throw new BadRequestException("Invalid capture payload");
		}

		return parsed.data;
	}
}
