import { Global, Logger, Module, type Provider } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { type Auth, createAuth } from "@wandit/auth";
import { CreditsService } from "../credits/application/services/credits.service";
import { CreditsModule } from "../credits/credits.module";
import { AUTH_INSTANCE } from "./auth.constants";
import { AuthController } from "./presentation/http/controllers/auth.controller";
import { AuthMeController } from "./presentation/http/controllers/me.controller";
import { AuthGuard } from "./presentation/http/guards/auth.guard";

const logger = new Logger("AuthModule");

const authProvider: Provider<Auth> = {
	provide: AUTH_INSTANCE,
	inject: [CreditsService],
	useFactory: (creditsService: CreditsService) =>
		createAuth({
			onUserCreated: async (user) => {
				try {
					await creditsService.grantSignupCredits(user.id);
				} catch (error) {
					logger.error("Signup credit grant failed", error);
				}
			},
		}),
};

@Global()
@Module({
	controllers: [AuthController, AuthMeController],
	exports: [AUTH_INSTANCE, AuthGuard],
	imports: [CreditsModule],
	providers: [
		authProvider,
		AuthGuard,
		{
			provide: APP_GUARD,
			useExisting: AuthGuard,
		},
	],
})
export class AuthModule {}
