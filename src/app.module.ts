import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RawDataProcessingModule } from './raw-data-processing/raw-data-processing.module';
import { CrawlersModule } from './crawlers/crawlers.module';
import { AiModule } from './ai/ai.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [RawDataProcessingModule, CrawlersModule, AiModule, QueueModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
