import { Body, Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EmptyDto } from '../../common/dto/empty.dto';
import { AiRunsService } from './ai-runs.service';
import { ListAiRunsQueryDto } from './dto/list-ai-runs-query.dto';
import { AiRunResponseDto } from './dto/ai-run-response.dto';
import { AiThrottlerGuard } from './ai-throttler.guard';
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiRunsService) {}
  @Get('runs')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [AiRunResponseDto] })
  @UseGuards(AiThrottlerGuard)
  list(@Query() query: ListAiRunsQueryDto, @Body() _body: EmptyDto) {
    void _body;
    return this.service.list(query);
  }
}
