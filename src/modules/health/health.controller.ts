import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService, HealthStatus } from './health.service';

@ApiTags('health')
@SkipThrottle({ short: true, medium: true, long: true })
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    description: 'Serviço no ar',
    schema: {
      example: {
        data: { status: 'ok' },
        meta: {
          timestamp: '2026-09-07T21:30:00.123Z',
          requestId: 'req_abc123def456',
        },
      },
    },
  })
  check(): HealthStatus {
    return this.healthService.check();
  }
}
