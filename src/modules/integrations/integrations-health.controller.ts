import { Body, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyOnly } from '../../common/decorators/api-key-only.decorator';
import { EmptyDto } from '../../common/dto/empty.dto';
import { HealthService } from '../health/health.service';
@ApiTags('integrations')
@ApiBearerAuth()
@ApiKeyOnly()
@Controller('integrations')
export class IntegrationsHealthController {
  constructor(private readonly health: HealthService) {}
  @Get('health')
  check(@Query() _query: EmptyDto, @Body() _body: EmptyDto) {
    void _query;
    void _body;
    return this.health.check();
  }
}
