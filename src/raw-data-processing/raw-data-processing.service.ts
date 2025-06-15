import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, GenotypeSource } from '@prisma/client';
import * as readline from 'readline';
import { Readable } from 'stream';

@Injectable()
export class RawDataProcessingService {
  private readonly logger = new Logger(RawDataProcessingService.name);
  private prisma = new PrismaClient();

  async processReportFromBuffer(
    fileBuffer: Buffer,
    source: GenotypeSource,
  ): Promise<void> {
    this.logger.log(
      `Starting to process report from buffer with source: ${source}`,
    );

    // Convert buffer to stream for line-by-line processing
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    let count = 0;
    const batchSize = 1000; // Adjust batch size as needed
    let genotypeBatch: {
      rsid: string;
      chromosome: string;
      position: number;
      genotype: string;
      source: GenotypeSource;
    }[] = [];

    for await (const line of rl) {
      if (line.startsWith('#') || line.startsWith('rsid')) {
        // Skip comments and header
        continue;
      }

      const [rsid, chromosome, position, genotype] = line.split('\t');

      if (rsid && chromosome && position && genotype) {
        genotypeBatch.push({
          rsid,
          chromosome,
          position: parseInt(position, 10),
          genotype,
          source,
        });
        count++;

        if (genotypeBatch.length >= batchSize) {
          await this.insertGenotypeBatch(genotypeBatch);
          genotypeBatch = [];
          this.logger.log(`Processed ${count} records...`);
        }
      }
    }

    if (genotypeBatch.length > 0) {
      await this.insertGenotypeBatch(genotypeBatch);
    }

    this.logger.log(
      `Finished processing report. Total records processed: ${count}`,
    );
  }

  // Keep the original method for backward compatibility
  async processReport(filePath: string, source: GenotypeSource): Promise<void> {
    this.logger.log(
      `Starting to process report from file: ${filePath} with source: ${source}`,
    );

    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);
    return this.processReportFromBuffer(fileBuffer, source);
  }

  private async insertGenotypeBatch(genotypeData: any[]) {
    try {
      const promises = genotypeData.map((genotype) =>
        this.prisma.genotypeData.upsert({
          where: {
            rsid_source: {
              rsid: genotype.rsid,
              source: genotype.source,
            },
          },
          update: {
            chromosome: genotype.chromosome,
            position: genotype.position,
            genotype: genotype.genotype,
          },
          create: {
            rsid: genotype.rsid,
            chromosome: genotype.chromosome,
            position: genotype.position,
            genotype: genotype.genotype,
            source: genotype.source,
          },
        }),
      );
      await this.prisma.$transaction(promises);
    } catch (error) {
      this.logger.error('Error inserting genotype batch:', error);
      // Decide on error handling: throw error, log and continue, etc.
    }
  }

  async syncDanteLabsToSnpTable(): Promise<void> {
    try {
      this.logger.log('Starting sync of DanteLabs data to Snp table...');

      const result = await this.prisma.$executeRaw`
        INSERT INTO "Snp" (rsid, chromosome, position)
        SELECT DISTINCT
            rsid,
            chromosome,
            position
        FROM "GenotypeData"
        WHERE source = 'DANTELABS'
        ON CONFLICT (rsid) DO NOTHING;
      `;

      this.logger.log(
        `Synced DanteLabs data to Snp table. Rows affected: ${result}`,
      );
    } catch (error) {
      this.logger.error('Error syncing DanteLabs data to Snp table:', error);
      throw error;
    }
  }

  async sync23andMeToSnpTable(): Promise<void> {
    try {
      this.logger.log('Starting sync of 23andMe data to Snp table...');

      const result = await this.prisma.$executeRaw`
        INSERT INTO "Snp" (rsid, chromosome, position)
        SELECT DISTINCT
            rsid,
            chromosome,
            position
        FROM "GenotypeData"
        WHERE source = 'TWENTYTHREEANDME'
        ON CONFLICT (rsid) DO NOTHING;
      `;

      this.logger.log(
        `Synced 23andMe data to Snp table. Rows affected: ${result}`,
      );
    } catch (error) {
      this.logger.error('Error syncing 23andMe data to Snp table:', error);
      throw error;
    }
  }
}
