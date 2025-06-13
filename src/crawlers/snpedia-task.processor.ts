import { Injectable, Logger } from '@nestjs/common';
import { TaskProcessor } from '../queue/queue.service';
import { SnpediaService } from './snpedia.service';

@Injectable()
export class SnpediaTaskProcessor implements TaskProcessor {
  readonly taskType = 'snpedia-update';
  private readonly logger = new Logger(SnpediaTaskProcessor.name);

  constructor(private readonly snpediaService: SnpediaService) {}

  async process(taskId: string, args?: any): Promise<any> {
    const rsid = taskId;
    this.logger.log(`Processing SNPedia update for RSID: ${rsid}`);

    try {
      // Use the existing service method to fetch and interpret SNP data
      const result = await this.snpediaService.fetchAndInterpretSnpData(rsid);

      this.logger.log(
        `Successfully processed SNPedia update for RSID: ${rsid}`,
      );
      return {
        rsid,
        success: true,
        timestamp: new Date().toISOString(),
        dataUpdated: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process SNPedia update for RSID: ${rsid}`,
        error,
      );
      throw error;
    }
  }
}
