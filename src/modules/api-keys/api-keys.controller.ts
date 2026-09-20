import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { OwnerThrottlerGuard } from '../auth/guards/owner-throttler.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmptyDto } from '../../common/dto/empty.dto';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreatedApiKeyResponseDto } from './dto/created-api-key-response.dto';
@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: CreatedApiKeyResponseDto })
  @UseGuards(OwnerThrottlerGuard)
  create(@Body() dto: CreateApiKeyDto, @Query() _query: EmptyDto) {
    void _query;
    return this.service.create(dto);
  }
  @Get()
  list(@Query() pagination: PaginationDto, @Body() _body: EmptyDto) {
    void _body;
    return this.service.list(pagination);
  }
  @Post(':id/revoke')
  @HttpCode(200)
  revoke(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _body: EmptyDto,
    @Query() _query: EmptyDto,
  ) {
    void _query;
    void _body;
    return this.service.revoke(id);
  }
}
