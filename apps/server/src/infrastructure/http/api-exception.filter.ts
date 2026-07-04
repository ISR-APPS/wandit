import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ZodValidationIssue } from "./zod-validation.pipe";

type ValidationErrorDetail = {
	field: string;
	messages: string[];
};

type NormalizedError = {
	code: string;
	details?: ValidationErrorDetail[];
	message: string;
	statusCode: number;
};

type HttpExceptionResponse = {
	code?: unknown;
	error?: unknown;
	issues?: unknown;
	message?: unknown;
	statusCode?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(ApiExceptionFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const http = host.switchToHttp();
		const request = http.getRequest<FastifyRequest>();
		const reply = http.getResponse<FastifyReply>();

		if (reply.sent) {
			return;
		}

		const error = this.normalizeException(exception);
		const timestamp = new Date().toISOString();

		if (error.statusCode >= 500) {
			this.logger.error(
				`Unhandled exception on ${request.method} ${request.url} (${request.id})`,
				exception instanceof Error ? exception.stack : String(exception),
			);
		}

		reply.status(error.statusCode).send({
			error: {
				code: error.code,
				...(error.details ? { details: error.details } : {}),
				message: error.message,
				path: request.url,
				requestId: request.id,
				statusCode: error.statusCode,
				timestamp,
			},
		});
	}

	private normalizeException(exception: unknown): NormalizedError {
		if (!(exception instanceof HttpException)) {
			return {
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			};
		}

		const statusCode = exception.getStatus();
		const response = exception.getResponse();
		const details =
			statusCode === HttpStatus.BAD_REQUEST
				? this.extractValidationDetails(response)
				: undefined;

		return {
			code: details
				? "VALIDATION_ERROR"
				: this.codeForExceptionResponse(response, statusCode),
			...(details ? { details } : {}),
			message: details
				? "Validation failed"
				: this.messageForException(exception, response, statusCode),
			statusCode,
		};
	}

	private codeForExceptionResponse(
		response: string | object,
		statusCode: number,
	) {
		if (typeof response !== "string") {
			const body = response as HttpExceptionResponse;

			if (typeof body.code === "string" && body.code.length > 0) {
				return body.code;
			}
		}

		return this.codeForStatus(statusCode);
	}

	private extractValidationDetails(
		response: string | object,
	): ValidationErrorDetail[] | undefined {
		if (typeof response === "string") {
			return undefined;
		}

		const body = response as HttpExceptionResponse;

		if (this.isZodIssueList(body.issues)) {
			return this.zodIssuesToDetails(body.issues);
		}

		if (this.isStringList(body.message)) {
			return this.classValidatorMessagesToDetails(body.message);
		}

		return undefined;
	}

	private zodIssuesToDetails(
		issues: readonly ZodValidationIssue[],
	): ValidationErrorDetail[] {
		const details = new Map<string, string[]>();

		for (const issue of issues) {
			this.addDetail(details, issue.path.map(String).join("."), issue.message);
		}

		return this.detailsMapToArray(details);
	}

	private classValidatorMessagesToDetails(
		messages: readonly string[],
	): ValidationErrorDetail[] {
		const details = new Map<string, string[]>();

		for (const message of messages) {
			this.addDetail(
				details,
				this.fieldFromClassValidatorMessage(message),
				message,
			);
		}

		return this.detailsMapToArray(details);
	}

	private fieldFromClassValidatorMessage(message: string) {
		const propertyMatch = /^property\s+([^\s]+)\s+/.exec(message);

		if (propertyMatch) {
			return propertyMatch[1]?.replace(/^["']|["']$/g, "") ?? "";
		}

		return message.split(" ")[0] ?? "";
	}

	private addDetail(
		details: Map<string, string[]>,
		field: string,
		message: string,
	) {
		const messages = details.get(field) ?? [];
		messages.push(message);
		details.set(field, messages);
	}

	private detailsMapToArray(details: Map<string, string[]>) {
		return [...details.entries()].map(([field, messages]) => ({
			field,
			messages,
		}));
	}

	private messageForException(
		exception: HttpException,
		response: string | object,
		statusCode: number,
	) {
		if (typeof response === "string") {
			return response;
		}

		const body = response as HttpExceptionResponse;

		if (typeof body.message === "string") {
			return body.message;
		}

		if (this.isStringList(body.message)) {
			return body.message.join("; ");
		}

		if (typeof body.error === "string") {
			return body.error;
		}

		return exception.message || this.defaultMessageForStatus(statusCode);
	}

	private codeForStatus(statusCode: number) {
		switch (statusCode) {
			case HttpStatus.BAD_REQUEST:
				return "BAD_REQUEST";
			case HttpStatus.UNAUTHORIZED:
				return "UNAUTHORIZED";
			case HttpStatus.FORBIDDEN:
				return "FORBIDDEN";
			case HttpStatus.NOT_FOUND:
				return "NOT_FOUND";
			case HttpStatus.CONFLICT:
				return "CONFLICT";
			case HttpStatus.UNPROCESSABLE_ENTITY:
				return "UNPROCESSABLE_ENTITY";
			case HttpStatus.TOO_MANY_REQUESTS:
				return "TOO_MANY_REQUESTS";
			default:
				return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "HTTP_ERROR";
		}
	}

	private defaultMessageForStatus(statusCode: number) {
		switch (statusCode) {
			case HttpStatus.BAD_REQUEST:
				return "Bad request";
			case HttpStatus.UNAUTHORIZED:
				return "Unauthorized";
			case HttpStatus.FORBIDDEN:
				return "Forbidden";
			case HttpStatus.NOT_FOUND:
				return "Not found";
			default:
				return "Internal server error";
		}
	}

	private isStringList(value: unknown): value is string[] {
		return (
			Array.isArray(value) && value.every((item) => typeof item === "string")
		);
	}

	private isZodIssueList(value: unknown): value is ZodValidationIssue[] {
		return (
			Array.isArray(value) &&
			value.every(
				(item) =>
					this.isRecord(item) &&
					Array.isArray(item.path) &&
					typeof item.message === "string",
			)
		);
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null;
	}
}
