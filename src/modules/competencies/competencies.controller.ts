import { Body, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EmptyDto } from '../../common/dto/empty.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CompetenciesService } from './competencies.service';
import { CompetenciesQueryDto } from './dto/competencies-query.dto';
import { SkillPrerequisiteResponseDto, SkillResponseDto } from './dto/skill-response.dto';

@ApiTags('competencies')
@ApiBearerAuth()
@Controller('competencies')
export class CompetenciesController {
  constructor(private readonly service: CompetenciesService) {}

  @Get()
  @ApiOkResponse({ type: [SkillResponseDto] })
  list(@Query() query: CompetenciesQueryDto, @Body() _body: EmptyDto) {
    void _body;
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: SkillResponseDto })
  getById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _body: EmptyDto,
    @Query() _query: EmptyDto,
  ) {
    void _body;
    void _query;
    return this.service.getById(id);
  }

  @Get(':id/prerequisites')
  @ApiOkResponse({ type: [SkillPrerequisiteResponseDto] })
  listPrerequisites(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() pagination: PaginationDto,
    @Body() _body: EmptyDto,
  ) {
    void _body;
    return this.service.listPrerequisites(id, pagination);
  }
}
