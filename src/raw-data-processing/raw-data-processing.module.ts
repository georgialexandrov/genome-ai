import { Module } from '@nestjs/common';
import { RawDataProcessingService } from './raw-data-processing.service';
import { RawDataProcessingController } from './raw-data-processing.controller';

@Module({
  controllers: [RawDataProcessingController],
  providers: [RawDataProcessingService],
  exports: [RawDataProcessingService], // Export if other modules need to use it directly
})
export class RawDataProcessingModule {}
