import {
  Controller,
  Get,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  Query,
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

  @Get('interpret/:rsid')
  @HttpCode(HttpStatus.OK)
  async interpretSnpData(@Param('rsid') rsid: string) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' };
    }

    this.logger.log(`Received request to interpret data for RSID: ${rsid}`);
    try {
      const result = await this.snpediaService.fetchAndInterpretSnpData(rsid);
      return {
        message: `Successfully interpreted data for ${rsid}`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error interpreting data for ${rsid}:`, error);
      return {
        message: `Error interpreting data for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Post('genotype/:rsid')
  @HttpCode(HttpStatus.OK)
  async updateGenotype(
    @Param('rsid') rsid: string,
    @Body('genotype') genotype: string,
  ) {
    if (!rsid || !genotype) {
      this.logger.warn('RSID or genotype parameter is missing');
      return { message: 'RSID and genotype parameters are required' };
    }

    this.logger.log(
      `Received request to update genotype for RSID: ${rsid} to ${genotype}`,
    );
    try {
      await this.snpediaService.updateSnpGenotype(rsid, genotype);
      return {
        message: `Successfully updated genotype for ${rsid}`,
        data: { rsid, genotype },
      };
    } catch (error) {
      this.logger.error(`Error updating genotype for ${rsid}:`, error);
      return {
        message: `Error updating genotype for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('personalized/:rsid')
  @HttpCode(HttpStatus.OK)
  async getPersonalizedInterpretation(
    @Param('rsid') rsid: string,
    @Query('genotype') genotype?: string,
  ) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' };
    }

    this.logger.log(
      `Received request for personalized interpretation of RSID: ${rsid}${genotype ? ` with genotype: ${genotype}` : ''}`,
    );
    try {
      const result =
        await this.snpediaService.getSnpWithPersonalizedInterpretation(
          rsid,
          genotype,
        );
      return {
        message: `Successfully generated personalized interpretation for ${rsid}`,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Error getting personalized interpretation for ${rsid}:`,
        error,
      );
      return {
        message: `Error getting personalized interpretation for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('interpretation/:rsid')
  @HttpCode(HttpStatus.OK)
  async getStoredInterpretation(@Param('rsid') rsid: string) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' };
    }

    this.logger.log(
      `Received request for stored interpretation of RSID: ${rsid}`,
    );
    try {
      const interpretation =
        await this.snpediaService.getStoredInterpretation(rsid);

      if (!interpretation) {
        return {
          message: `No stored interpretation found for ${rsid}`,
          data: null,
        };
      }

      return {
        message: `Successfully retrieved stored interpretation for ${rsid}`,
        data: interpretation,
      };
    } catch (error) {
      this.logger.error(
        `Error getting stored interpretation for ${rsid}:`,
        error,
      );
      return {
        message: `Error getting stored interpretation for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Post('interpretation/regenerate/:rsid')
  @HttpCode(HttpStatus.OK)
  async regenerateInterpretation(@Param('rsid') rsid: string) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' };
    }

    this.logger.log(
      `Received request to regenerate interpretation for RSID: ${rsid}`,
    );
    try {
      const interpretation =
        await this.snpediaService.regenerateInterpretation(rsid);
      return {
        message: `Successfully regenerated interpretation for ${rsid}`,
        data: interpretation,
      };
    } catch (error) {
      this.logger.error(
        `Error regenerating interpretation for ${rsid}:`,
        error,
      );
      return {
        message: `Error regenerating interpretation for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('data/:rsid')
  @HttpCode(HttpStatus.OK)
  async getSnpData(@Param('rsid') rsid: string) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' };
    }

    this.logger.log(`Received request for SNP data for RSID: ${rsid}`);
    try {
      const snpData = await this.snpediaService.getSnpData(rsid);
      return {
        message: `Successfully retrieved data for ${rsid}`,
        data: snpData,
      };
    } catch (error) {
      this.logger.error(`Error getting SNP data for ${rsid}:`, error);
      return {
        message: `Error getting SNP data for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('snpedia-data/:rsid')
  @HttpCode(HttpStatus.OK)
  async getSnpediaParsedData(@Param('rsid') rsid: string) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' };
    }

    this.logger.log(
      `Received request for SNPedia parsed data for RSID: ${rsid}`,
    );
    try {
      const snpediaData = await this.snpediaService.getSnpediaParsedData(rsid);

      if (!snpediaData) {
        return {
          message: `No SNPedia parsed data found for ${rsid}`,
          data: null,
        };
      }

      return {
        message: `Successfully retrieved SNPedia parsed data for ${rsid}`,
        data: snpediaData,
      };
    } catch (error) {
      this.logger.error(
        `Error getting SNPedia parsed data for ${rsid}:`,
        error,
      );
      return {
        message: `Error getting SNPedia parsed data for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('refresh-check/:rsid')
  @HttpCode(HttpStatus.OK)
  async checkIfRefreshNeeded(@Param('rsid') rsid: string) {
    if (!rsid) {
      this.logger.warn('RSID parameter is missing');
      return { message: 'RSID parameter is required' };
    }

    this.logger.log(`Checking if refresh is needed for RSID: ${rsid}`);
    try {
      const shouldRefresh =
        await this.snpediaService.shouldRefreshSnpediaData(rsid);
      return {
        message: `Refresh check completed for ${rsid}`,
        data: {
          rsid,
          shouldRefresh,
          recommendation: shouldRefresh
            ? 'Data is stale or missing, recommend fetching fresh data'
            : 'Data is current, no refresh needed',
        },
      };
    } catch (error) {
      this.logger.error(`Error checking refresh status for ${rsid}:`, error);
      return {
        message: `Error checking refresh status for ${rsid}: ${error.message}`,
        error: error.message,
      };
    }
  }
}
