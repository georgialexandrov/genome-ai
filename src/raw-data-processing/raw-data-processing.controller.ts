import { Controller, Post, Query, Logger } from '@nestjs/common';
import { RawDataProcessingService } from './raw-data-processing.service'; // Corrected import path

@Controller('raw-data-processing')
export class RawDataProcessingController {
  private readonly logger = new Logger(RawDataProcessingController.name);
  constructor(
    private readonly rawDataProcessingService: RawDataProcessingService,
  ) {}

  @Post('process')
  async processReport(@Query('fileName') fileName: string) {
    if (!fileName) {
      this.logger.error('File name is required');
      return { message: 'File name is required' };
    }
    try {
      this.logger.log(`Received request to process file: ${fileName}`);
      // Assuming the file is in the project root, adjust path as necessary
      // For security, you might want to restrict file paths or have a predefined location
      const filePath = `../../${fileName}`; // Adjust if files are in a different relative location
      await this.rawDataProcessingService.processReport(filePath);
      this.logger.log(`Successfully started processing for file: ${fileName}`);
      return { message: `Processing started for file: ${fileName}` };
    } catch (error) {
      this.logger.error(`Error processing file ${fileName}:`, error);
      return { message: `Error processing file: ${error.message}` };
    }
  }
}
