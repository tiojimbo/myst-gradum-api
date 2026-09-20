import { Module } from '@nestjs/common';
import { HealthModule } from '../health/health.module';
import { IntegrationsHealthController } from './integrations-health.controller';
@Module({ imports: [HealthModule], controllers: [IntegrationsHealthController] })
export class IntegrationsModule {}
