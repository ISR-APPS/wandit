import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { EmailSendPolicyService } from "./application/services/email-send-policy.service";
import { EmailService } from "./application/services/email.service";
import { AuthEmailSendsRepository } from "./infrastructure/persistence/auth-email-sends.repository";

@Module({
	exports: [EmailSendPolicyService, EmailService],
	imports: [DatabaseModule],
	providers: [AuthEmailSendsRepository, EmailSendPolicyService, EmailService],
})
export class EmailModule {}
