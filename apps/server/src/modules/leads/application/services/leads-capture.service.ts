/**
 * The public capture flow: anonymous, cross-origin, fire-and-forget.
 *
 * The page's injected runtime posts JSON as text/plain (a CORS simple request
 * — no preflight), so the body arrives as a raw string; curl/tests may send
 * application/json, which arrives pre-parsed. Every quiet-discard path
 * (honeypot, duplicate) answers the same { ok: true } as a real insert so
 * bots learn nothing from the response.
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

// Same phone hitting the same project inside this window is a double submit
// (page retries, impatient double click, heuristic + event both firing).
const DUPLICATE_WINDOW_MS = 2 * 60_000;

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
		if (!this.throttle.allow(ip)) {
			throw new HttpException(
				"Too many submissions",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

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

		const isDuplicate = await this.leadsRepository.hasRecentLeadWithPhone(
			project.id,
			phone,
			new Date(Date.now() - DUPLICATE_WINDOW_MS),
		);
		if (isDuplicate) {
			return { ok: true };
		}

		const deploymentId = await this.leadsRepository.findActiveDeploymentId(
			project.id,
		);

		await this.leadsRepository.insertLead({
			attribution: body.attribution ?? null,
			commune: body.commune || null,
			deploymentId,
			// Spec: keep the raw phone as typed; the column only holds E.164.
			extras: { ...body.extras, _rawPhone: body.phone },
			name: body.name,
			phone,
			projectId: project.id,
			wilaya: body.wilaya || null,
		});

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
