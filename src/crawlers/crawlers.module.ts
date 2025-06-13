import { Module, OnModuleInit } from '@nestjs/common';
import { SnpediaService } from './snpedia.service';
import { SnpediaController } from './snpedia.controller';
import { SnpediaTaskProcessor } from './snpedia-task.processor';
import { SnpediaDiscoveryService } from './snpedia-discovery-api.service';
import { AiModule } from '../ai/ai.module';
import { ParsersModule } from '../parsers/parsers.module';
import { QueueModule } from '../queue/queue.module';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AiModule, ParsersModule, QueueModule],
  providers: [
    SnpediaService,
    SnpediaTaskProcessor,
    SnpediaDiscoveryService,
    PrismaService,
  ],
  controllers: [SnpediaController],
  exports: [SnpediaService, SnpediaDiscoveryService],
})
export class CrawlersModule implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly snpediaTaskProcessor: SnpediaTaskProcessor,
  ) {}

  async onModuleInit() {
    // Register the SNPedia task processor
    this.queueService.registerProcessor(this.snpediaTaskProcessor);
  }
}
