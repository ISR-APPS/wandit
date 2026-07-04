import { Global, Module, type Provider } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { type Auth, auth } from "@wandit/auth";

import { AUTH_INSTANCE } from "./auth.constants";
import { AuthController } from "./presentation/http/controllers/auth.controller";
import { AuthMeController } from "./presentation/http/controllers/me.controller";
import { AuthGuard } from "./presentation/http/guards/auth.guard";

const authProvider: Provider<Auth> = {
	provide: AUTH_INSTANCE,
	useFactory: () => auth,
};

@Global()
@Module({
	controllers: [AuthController, AuthMeController],
	exports: [AUTH_INSTANCE, AuthGuard],
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
