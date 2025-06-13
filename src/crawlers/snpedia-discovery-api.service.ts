import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import axios from 'axios';

interface SnpediaCategoryMember {
  pageid: number;
  ns: number;
  title: string;
}

interface SnpediaCategoryResponse {
  query: {
    categorymembers: SnpediaCategoryMember[];
  };
  'query-continue'?: {
    categorymembers: {
      cmcontinue: string;
    };
  };
  continue?: {
    cmcontinue: string;
    continue: string;
  };
}

interface SnpediaDiscoveryResult {
  rsids: string[];
  continueToken?: string;
}

@Injectable()
export class SnpediaDiscoveryService {
  private readonly logger = new Logger(SnpediaDiscoveryService.name);
  private readonly SNPEDIA_API_URL = 'https://bots.snpedia.com/api.php';

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Get SNPs from SNPedia using the category members API
   */
  async getSnpsFromCategory(
    continueToken?: string,
  ): Promise<SnpediaDiscoveryResult> {
    try {
      const params: any = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Is_a_snp',
        cmlimit: 'max', // Get maximum results per request
        format: 'json',
      };

      if (continueToken) {
        params.cmcontinue = continueToken;
      }

      this.logger.log(
        `Fetching SNPs from SNPedia API${continueToken ? ` with continue token: ${continueToken}` : ''}`,
      );

      const response = await axios.get<SnpediaCategoryResponse>(
        this.SNPEDIA_API_URL,
        {
          params,
          timeout: 30000,
          headers: {
            'User-Agent':
              'GenomeAI/1.0 (https://github.com/user/genome-ai; Research purposes)',
          },
        },
      );

      const members = response.data.query.categorymembers;
      this.logger.log(
        `Received ${members.length} category members from SNPedia`,
      );

      // Extract both RSIDs and I-identifiers from page titles
      const validSnpIds = members
        .map((member) => member.title)
        .filter((title) => {
          // Match traditional rs numbers or I-identifiers
          return /^(rs\d+|I\d+)$/i.test(title);
        })
        .map((title) => title.toLowerCase());

      this.logger.log(
        `Found ${validSnpIds.length} valid SNP identifiers (rs + I) in this batch`,
      );

      // Check for continuation
      const nextContinueToken =
        response.data.continue?.cmcontinue ||
        response.data['query-continue']?.categorymembers?.cmcontinue;

      return {
        rsids: [...new Set(validSnpIds)], // Remove duplicates
        continueToken: nextContinueToken,
      };
    } catch (error) {
      this.logger.error(`Error fetching SNPs from SNPedia API:`, error);
      throw error;
    }
  }

  /**
   * Discover all SNPs from SNPedia using the category API
   * Queue tasks immediately after each batch to start processing early
   */
  async discoverAllSnpsFromCategory(): Promise<string[]> {
    const allRsids: string[] = [];
    let continueToken: string | undefined;
    let batchCount = 0;
    let totalQueuedCount = 0;
    const maxBatches = 100; // Safety limit

    try {
      do {
        const result = await this.getSnpsFromCategory(continueToken);
        allRsids.push(...result.rsids);
        continueToken = result.continueToken;
        batchCount++;

        this.logger.log(
          `Batch ${batchCount}: Found ${result.rsids.length} RSIDs (Total: ${allRsids.length})${continueToken ? ', more batches available' : ', completed'}`,
        );

        // Queue tasks immediately for this batch
        if (result.rsids.length > 0) {
          const queuedInBatch = await this.queueSnpUpdatesForKnownSnps(
            result.rsids,
          );
          totalQueuedCount += queuedInBatch;

          if (queuedInBatch > 0) {
            this.logger.log(
              `✅ Queued ${queuedInBatch} tasks from batch ${batchCount} (Total queued: ${totalQueuedCount})`,
            );
          }
        }

        // Add delay to be respectful to SNPedia API
        if (continueToken) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } while (continueToken && batchCount < maxBatches);

      const uniqueRsids = [...new Set(allRsids)];
      this.logger.log(
        `Discovery completed: Found ${uniqueRsids.length} unique RSIDs in ${batchCount} batches, queued ${totalQueuedCount} total tasks`,
      );

      return uniqueRsids;
    } catch (error) {
      this.logger.error('Error during SNP discovery:', error);
      throw error;
    }
  }

  /**
   * Check if we have a SNP in our database
   */
  async hasSnpInDatabase(rsid: string): Promise<boolean> {
    const snp = await this.prisma.snp.findUnique({
      where: { rsid },
      select: { rsid: true },
    });
    return !!snp;
  }

  /**
   * Add SNP update tasks for RSIDs we have in our database
   * Uses upsert to handle duplicates gracefully
   */
  async queueSnpUpdatesForKnownSnps(rsids: string[]): Promise<number> {
    let queuedCount = 0;

    this.logger.log(
      `Checking ${rsids.length} RSIDs against our database for genotype data`,
    );

    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < rsids.length; i += batchSize) {
      const batch = rsids.slice(i, i + batchSize);

      // Check which SNPs we have in our database WITH genotype data
      const existingSnps = await this.prisma.snp.findMany({
        where: {
          rsid: {
            in: batch,
          },
        },
        select: { rsid: true, genotype: true },
      });

      // Queue tasks for existing SNPs (upsert handles duplicates)
      for (const snp of existingSnps) {
        try {
          await this.queueService.addTask(
            'snpedia-update',
            snp.rsid,
            {
              source: 'api-discovery',
              discoveredAt: new Date().toISOString(),
              hasGenotype: true,
              genotype: snp.genotype,
            },
            1, // Medium priority
          );
          queuedCount++;
        } catch (error) {
          this.logger.warn(`Failed to queue task for ${snp.rsid}:`, error);
        }
      }

      this.logger.log(
        `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rsids.length / batchSize)}: Found ${existingSnps.length} SNPs with genotype data`,
      );

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log(
      `Queued ${queuedCount} SNP update tasks for SNPs with genotype data`,
    );
    return queuedCount;
  }

  /**
   * Main discovery and queueing method using the SNPedia API
   * Tasks are queued immediately as each batch is processed
   */
  async discoverAndQueueSnpUpdates(): Promise<{
    discovered: number;
    queued: number;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log('Starting SNPedia API discovery and queueing process');

    try {
      // Get initial queue count to track how many we add
      const initialQueuedTasks = await this.prisma.taskQueue.count({
        where: {
          taskType: 'snpedia-update',
          status: 'pending',
        },
      });

      // Discover all RSIDs from SNPedia using the category API
      // This now also queues tasks immediately for each batch
      const discoveredRsids = await this.discoverAllSnpsFromCategory();

      // Get final queue count to see how many we actually added
      const finalQueuedTasks = await this.prisma.taskQueue.count({
        where: {
          taskType: 'snpedia-update',
          status: 'pending',
        },
      });

      const queuedCount = finalQueuedTasks - initialQueuedTasks;

      this.logger.log(
        `Discovered ${discoveredRsids.length} unique RSIDs from SNPedia API`,
      );

      const duration = Date.now() - startTime;
      this.logger.log(`Discovery and queueing completed in ${duration}ms`);

      return {
        discovered: discoveredRsids.length,
        queued: queuedCount,
        duration,
      };
    } catch (error) {
      this.logger.error('Error in discovery and queueing process:', error);
      throw error;
    }
  }

  /**
   * Test the SNPedia API endpoint
   */
  async testSnpediaApi(): Promise<{
    success: boolean;
    sampleRsids: string[];
    totalFound: number;
    error?: string;
  }> {
    try {
      this.logger.log('Testing SNPedia API endpoint...');

      const result = await this.getSnpsFromCategory();

      return {
        success: true,
        sampleRsids: result.rsids.slice(0, 10), // First 10 RSIDs as sample
        totalFound: result.rsids.length,
      };
    } catch (error) {
      this.logger.error('SNPedia API test failed:', error);
      return {
        success: false,
        sampleRsids: [],
        totalFound: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get discovery statistics
   */
  async getDiscoveryStats(): Promise<{
    totalSnpsInDatabase: number;
    queuedTasks: number;
    completedTasks: number;
    errorTasks: number;
  }> {
    const [totalSnps, queuedTasks, completedTasks, errorTasks] =
      await Promise.all([
        this.prisma.snp.count(),
        this.prisma.taskQueue.count({
          where: {
            taskType: 'snpedia-update',
            status: 'pending',
          },
        }),
        this.prisma.taskQueue.count({
          where: {
            taskType: 'snpedia-update',
            status: 'done',
          },
        }),
        this.prisma.taskQueue.count({
          where: {
            taskType: 'snpedia-update',
            status: 'error',
          },
        }),
      ]);

    return {
      totalSnpsInDatabase: totalSnps,
      queuedTasks,
      completedTasks,
      errorTasks,
    };
  }
}
