import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as readline from 'readline';

@Injectable()
export class RawDataProcessingService {
  private readonly logger = new Logger(RawDataProcessingService.name);
  private prisma = new PrismaClient();

  async processReport(filePath: string): Promise<void> {
    this.logger.log(`Starting to process report from file: ${filePath}`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let count = 0;
    const batchSize = 1000; // Adjust batch size as needed
    let snpBatch: {
      rsid: string;
      chromosome: string;
      position: number;
      genotype: string;
    }[] = [];

    for await (const line of rl) {
      if (line.startsWith('#') || line.startsWith('rsid')) {
        // Skip comments and header
        continue;
      }

      const [rsid, chromosome, position, genotype] = line.split('\t');

      if (rsid && chromosome && position && genotype) {
        snpBatch.push({
          rsid,
          chromosome,
          position: parseInt(position, 10),
          genotype, // Genotype is now included
        });
        count++;

        if (snpBatch.length >= batchSize) {
          await this.insertSnpBatch(snpBatch);
          snpBatch = [];
          this.logger.log(`Processed ${count} records...`);
        }
      }
    }

    if (snpBatch.length > 0) {
      await this.insertSnpBatch(snpBatch);
    }

    this.logger.log(
      `Finished processing report. Total records processed: ${count}`,
    );
  }

  private async insertSnpBatch(snpData: any[]) {
    try {
      const promises = snpData.map((snp) =>
        this.prisma.snp.upsert({
          where: { rsid: snp.rsid },
          update: {
            chromosome: snp.chromosome,
            position: snp.position,
            genotype: snp.genotype, // Added genotype to update
          },
          create: {
            rsid: snp.rsid,
            chromosome: snp.chromosome,
            position: snp.position,
            genotype: snp.genotype, // Added genotype to create
          },
        }),
      );
      await this.prisma.$transaction(promises);
    } catch (error) {
      this.logger.error('Error inserting SNP batch:', error);
      // Decide on error handling: throw error, log and continue, etc.
    }
  }
}
