import { Module } from '@nestjs/common';
import { SnpediaService } from './snpedia.service';
import { SnpediaController } from './snpedia.controller';

@Module({
  providers: [SnpediaService],
  controllers: [SnpediaController]
})
export class CrawlersModule {}
