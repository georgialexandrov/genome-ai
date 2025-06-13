import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RawDataProcessingModule } from './raw-data-processing/raw-data-processing.module';
import { RawDataProcessingController } from './raw-data-processing/raw-data-processing.controller';
import { CrawlersModule } from './crawlers/crawlers.module';

@Module({
  imports: [RawDataProcessingModule, CrawlersModule],
  controllers: [AppController, RawDataProcessingController],
  providers: [AppService],
})
export class AppModule {}
