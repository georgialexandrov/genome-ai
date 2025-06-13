import { Module } from '@nestjs/common';
import { SnpediaService } from './snpedia.service';
import { SnpediaController } from './snpedia.controller';
import { AiModule } from '../ai/ai.module';
import { ParsersModule } from '../parsers/parsers.module';

@Module({
  imports: [AiModule, ParsersModule],
  providers: [SnpediaService],
  controllers: [SnpediaController],
  exports: [SnpediaService],
})
export class CrawlersModule {}
