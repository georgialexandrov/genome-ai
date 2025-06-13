import { Module } from '@nestjs/common';
import { SnpediaParserService } from './snpedia-parser.service';

@Module({
  providers: [SnpediaParserService],
  exports: [SnpediaParserService],
})
export class ParsersModule {}
