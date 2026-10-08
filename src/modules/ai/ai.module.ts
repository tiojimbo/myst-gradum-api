import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiRunsRepository } from './ai-runs.repository';
import { AiRunsService } from './ai-runs.service';
import { AiThrottlerGuard } from './ai-throttler.guard';
import { OpenRouterClient } from './openrouter.client';
import { PromptRegistry } from './prompt.registry';
@Module({
  controllers: [AiController],
  providers: [
    AiGatewayService,
    AiRunsRepository,
    AiRunsService,
    AiThrottlerGuard,
    OpenRouterClient,
    PromptRegistry,
  ],
  exports: [AiGatewayService, PromptRegistry],
})
export class AiModule {}
