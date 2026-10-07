import { Module } from '@nestjs/common';
import { CompetenciesController } from './competencies.controller';
import { CompetenciesRepository } from './competencies.repository';
import { CompetenciesService } from './competencies.service';

@Module({
  controllers: [CompetenciesController],
  providers: [CompetenciesRepository, CompetenciesService],
  exports: [CompetenciesService],
})
export class CompetenciesModule {}
