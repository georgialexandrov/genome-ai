import {
  Controller,
  Get,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SnpediaService } from './snpedia.service';

@Controller('crawlers/snpedia') // Adjusted base path for clarity if you have multiple crawlers
export class SnpediaController {
  private readonly logger = new Logger(SnpediaController.name);

  constructor(private readonly snpediaService: SnpediaService) {}

  @Get('fetch/:rsid')
  @HttpCode(HttpStatus.ACCEPTED) // 202 Accepted as fetching and storing is async
  async fetchSnpData(@Param('rsid') rsid: string) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' }; // Or throw BadRequestException
    }
    this.logger.log(`Received request to fetch data for RSID: ${rsid}`);
    try {
      // Intentionally not awaiting here if you want to return immediately
      // and let the process run in the background.
      // If you want to wait for completion, add await and change HttpCode accordingly (e.g., HttpStatus.OK)
      this.snpediaService.fetchAndStoreSnpData(rsid);
      return { message: `Fetching and storing data for ${rsid} initiated.` };
    } catch (error) {
      this.logger.error(`Error initiating data fetch for ${rsid}:`, error);
      // Consider returning a more specific error response
      return { message: `Error initiating data fetch for ${rsid}.` };
    }
  }
}
