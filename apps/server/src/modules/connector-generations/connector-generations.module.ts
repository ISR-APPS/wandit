import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { ConnectorGenerationsService } from "./application/services/connector-generations.service";
import { ConnectorGenerationsRepository } from "./infrastructure/persistence/connector-generations.repository";
import { ConnectorGenerationsController } from "./presentation/http/controllers/connector-generations.controller";

@Module({
	controllers: [ConnectorGenerationsController],
	// The repository is exported because the mcp-connectors module's
	// generation intercept writes attempt rows through it at queue time.
	exports: [ConnectorGenerationsRepository],
	imports: [DatabaseModule],
	providers: [ConnectorGenerationsRepository, ConnectorGenerationsService],
})
export class ConnectorGenerationsModule {}
