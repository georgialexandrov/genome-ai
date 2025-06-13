import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SnpediaDiscoveryService } from '../crawlers/snpedia-discovery-api.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [QueueController],
  providers: [QueueService, PrismaService, SnpediaDiscoveryService],
  exports: [QueueService],
})
export class QueueModule {}
