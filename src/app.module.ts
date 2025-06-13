import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RawDataProcessingModule } from './raw-data-processing/raw-data-processing.module';
import { RawDataProcessingController } from './raw-data-processing/raw-data-processing.controller';

@Module({
  imports: [RawDataProcessingModule],
  controllers: [AppController, RawDataProcessingController],
  providers: [AppService],
})
export class AppModule {}
