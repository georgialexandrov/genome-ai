import { Module } from '@nestjs/common';
import { RawDataProcessingService } from './raw-data-processing.service';

@Module({
  controllers: [],
  providers: [RawDataProcessingService],
  exports: [RawDataProcessingService], // Export for CLI and other modules
})
export class RawDataProcessingModule {}
