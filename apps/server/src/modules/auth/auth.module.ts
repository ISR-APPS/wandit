import { Module } from "@nestjs/common";

import { AuthController } from "./presentation/http/controllers/auth.controller";

@Module({
	controllers: [AuthController],
})
export class AuthModule {}
