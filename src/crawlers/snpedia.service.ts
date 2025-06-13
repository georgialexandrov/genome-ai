import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import {
  SnpediaParserService,
  SnpediaInput,
  ComprehensiveSnpData,
} from '../parsers/snpedia-parser.service';

// Define an interface for the new SNPedia API response format
interface SnpediaParsePage {
  title: string;
  pageid: number;
  text: {
    '*': string;
  };
  wikitext: {
    '*': string;
  };
}

interface SnpediaResponse {
  parse: SnpediaParsePage;
}

@Injectable()
export class SnpediaService {
  private readonly logger = new Logger(SnpediaService.name);
  private prisma = new PrismaClient();
  private readonly baseUrl = 'https://bots.snpedia.com/api.php';

  constructor(
    private readonly aiService: AiService,
    private readonly snpediaParser: SnpediaParserService,
  ) {}

  /**
   * Fetch SNP data from SNPedia and store in database using comprehensive parser
   */
  async fetchAndStoreSnpData(snpId: string): Promise<void> {
    this.logger.log(`Fetching data for SNP ID: ${snpId}`);

    try {
      const response = await axios.get<SnpediaResponse>(this.baseUrl, {
        params: {
          action: 'parse',
          page: snpId,
          prop: 'text|wikitext',
          format: 'json',
        },
      });

      // Extract HTML and wikitext from the new response format
      const htmlContent = response.data.parse.text['*'];
      const wikitextContent = response.data.parse.wikitext['*'];

      // Parse using the comprehensive parser
      const parserInput: SnpediaInput = {
        text: htmlContent,
        wikitext: wikitextContent,
      };

      const parsedData: ComprehensiveSnpData =
        this.snpediaParser.parseSnpediaContent(parserInput);

      // Store in database
      await this.storeComprehensiveSnpData(snpId, parsedData);

      this.logger.log(
        `Successfully processed and stored SNP data for ${snpId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing SNP ${snpId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Store comprehensive SNP data in database
   */
  private async storeComprehensiveSnpData(
    snpId: string,
    data: ComprehensiveSnpData,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Use consistent rsid - always use snpId (normalized) to avoid conflicts
      const normalizedRsid = snpId.toLowerCase();

      // Prepare core SNP data
      const snpData = {
        rsid: normalizedRsid, // Always use the input snpId for consistency
        gene: data.gene,
        chromosome: data.chromosome,
        position: data.position,
        summary: data.summary,
        magnitude:
          data.maxMagnitude ||
          (data.genotypes.length > 0
            ? Math.max(...data.genotypes.map((g) => g.magnitude))
            : null),
        snpediaParsedData: JSON.parse(JSON.stringify(data)), // Store the complete parsed data as JSON
        snpediaLastFetched: new Date(), // Mark when this data was fetched
        // orientation: data.orientation,
        // referenceAllele: data.referenceAllele,
        // assembly: data.assembly,
        // dbSNPBuild: data.dbSNPBuild,
        // gmaf: data.gmaf,
        // riskAllele: data.riskAllele,
        // genderSpecific: data.genderSpecific,
      };

      // Remove undefined values (but keep the JSON data)
      Object.keys(snpData).forEach(
        (key) =>
          key !== 'snpediaParsedData' &&
          key !== 'snpediaLastFetched' &&
          snpData[key as keyof typeof snpData] === undefined &&
          delete snpData[key as keyof typeof snpData],
      );

      // Upsert SNP record - use same normalized rsid for where clause and data
      console.log('Try to update', normalizedRsid, { snpData });
      const snp = await tx.snp.upsert({
        where: { rsid: normalizedRsid },
        update: snpData,
        create: snpData,
      });

      this.logger.log(`Upserted SNP record for ${normalizedRsid}`);

      // Clear existing related data using normalized rsid
      await tx.phenotype.deleteMany({ where: { rsid: normalizedRsid } });
      this.logger.log(`Cleared existing phenotypes for ${normalizedRsid}`);
      console.log(JSON.stringify(data, null, 2));
      // Store genotype-specific phenotypes
      if (data.genotypes && data.genotypes.length > 0) {
        for (const genotype of data.genotypes) {
          await tx.phenotype.create({
            data: {
              rsid: normalizedRsid,
              phenotype: genotype.summary,
              riskAllele: genotype.genotype,
              effectSize: genotype.magnitude,
            },
          });
        }
        this.logger.log(
          `Created ${data.genotypes.length} phenotypes for ${normalizedRsid}`,
        );
      }

      // Store traits as tags if they exist
      if (data.traits && data.traits.length > 0) {
        for (const trait of data.traits) {
          // Check if tag exists, create if not
          await tx.tag.upsert({
            where: { name: trait },
            update: {},
            create: {
              name: trait,
              category: 'trait',
            },
          });

          // Link SNP to tag
          await tx.snpTag.upsert({
            where: {
              snpId_tagId: {
                snpId: normalizedRsid,
                tagId: (await tx.tag.findUnique({ where: { name: trait } }))!
                  .id,
              },
            },
            update: {},
            create: {
              snpId: normalizedRsid,
              tagId: (await tx.tag.findUnique({ where: { name: trait } }))!.id,
            },
          });
        }
        this.logger.log(
          `Linked ${data.traits.length} traits for ${normalizedRsid}`,
        );
      }

      // Store PMIDs and external links as metadata
      if (data.pmids && data.pmids.length > 0) {
        this.logger.log(
          `Found ${data.pmids.length} PMIDs for ${normalizedRsid}: ${data.pmids.join(', ')}`,
        );
      }

      if (data.externalLinks && data.externalLinks.length > 0) {
        this.logger.log(
          `Found ${data.externalLinks.length} external links for ${normalizedRsid}`,
        );
      }

      // Log data quality metrics
      this.logger.log(
        `Data quality for ${normalizedRsid}: ${JSON.stringify(data.sourceData)}`,
      );
    });
  }

  /**
   * Fetch SNP data and generate AI interpretation
   */
  async fetchAndInterpretSnpData(snpId: string): Promise<{
    snpData: any;
    aiInterpretation: any;
  }> {
    this.logger.log(`Fetching and interpreting data for SNP ID: ${snpId}`);

    // First fetch and store the SNP data
    await this.fetchAndStoreSnpData(snpId);

    // Then retrieve the stored data with phenotypes
    const snpData = await this.prisma.snp.findUnique({
      where: { rsid: snpId },
      include: {
        phenotypes: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!snpData) {
      throw new Error(`SNP ${snpId} not found after fetching`);
    }
    console.log({ phenotypes: snpData.phenotypes });
    if (
      snpData.phenotypes.length === 1 &&
      snpData.phenotypes.at(0)?.phenotype === 'common in complete genomics'
    ) {
      return { snpData, aiInterpretation: null };
    }
    // Generate AI interpretation using the comprehensive data
    const aiInterpretation = await this.aiService.interpretSnpData({
      rsid: snpData.rsid,
      gene: snpData.gene || undefined,
      summary: snpData.summary || undefined,
      magnitude: snpData.magnitude || undefined,
      genotype: snpData.genotype || undefined,
      phenotypes: snpData.phenotypes.map((p) => ({
        genotype: p.riskAllele || '',
        magnitude: p.effectSize || undefined,
        summary: p.phenotype,
      })),
    });

    // Store the AI interpretation in the database
    await this.storeInterpretation(snpId, aiInterpretation);

    this.logger.log(`Generated and stored AI interpretation for ${snpId}`);

    return {
      snpData,
      aiInterpretation,
    };
  }

  /**
   * Store AI interpretation in the database
   */
  private async storeInterpretation(
    snpId: string,
    aiInterpretation: any,
  ): Promise<void> {
    try {
      // Convert the AI interpretation object to a JSON string for storage
      const interpretationText = JSON.stringify(aiInterpretation);

      await this.prisma.snp.update({
        where: { rsid: snpId },
        data: {
          interpretation: interpretationText,
          interpretationGeneratedAt: new Date(),
        },
      });

      this.logger.log(`Stored AI interpretation for ${snpId} in database`);
    } catch (error) {
      this.logger.error(`Error storing interpretation for ${snpId}:`, error);
      throw new Error(`Failed to store interpretation: ${error.message}`);
    }
  }

  /**
   * Update the user's genotype for a specific SNP
   */
  async updateSnpGenotype(snpId: string, genotype: string): Promise<void> {
    this.logger.log(`Updating genotype for SNP ${snpId} to: ${genotype}`);

    try {
      await this.prisma.snp.upsert({
        where: { rsid: snpId },
        update: { genotype },
        create: {
          rsid: snpId,
          genotype,
        },
      });

      this.logger.log(`Successfully updated genotype for ${snpId}`);
    } catch (error) {
      this.logger.error(`Error updating genotype for ${snpId}:`, error);
      throw new Error(`Failed to update genotype: ${error.message}`);
    }
  }

  /**
   * Get SNP data with AI interpretation for a specific user genotype
   */
  async getSnpWithPersonalizedInterpretation(
    snpId: string,
    userGenotype?: string,
  ): Promise<{
    snpData: any;
    aiInterpretation: any;
  }> {
    this.logger.log(`Getting personalized interpretation for SNP ${snpId}`);

    // If userGenotype is provided, update it in the database first
    if (userGenotype) {
      await this.updateSnpGenotype(snpId, userGenotype);
    }

    // Fetch the SNP data (will include the updated genotype if provided)
    const snpData = await this.prisma.snp.findUnique({
      where: { rsid: snpId },
      include: {
        phenotypes: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!snpData) {
      throw new Error(
        `SNP ${snpId} not found in database. Please fetch from SNPedia first.`,
      );
    }

    // Check if we have a stored interpretation
    let aiInterpretation: any = null;
    if (snpData.interpretation) {
      try {
        aiInterpretation = JSON.parse(snpData.interpretation);
        this.logger.log(`Using stored AI interpretation for ${snpId}`);
      } catch (error) {
        this.logger.warn(
          `Failed to parse stored interpretation for ${snpId}, will regenerate`,
        );
      }
    }

    // Generate new interpretation if none exists or if genotype was updated
    if (!aiInterpretation || userGenotype) {
      this.logger.log(`Generating new AI interpretation for ${snpId}`);

      aiInterpretation = await this.aiService.interpretSnpData({
        rsid: snpData.rsid,
        gene: snpData.gene || undefined,
        summary: snpData.summary || undefined,
        magnitude: snpData.magnitude || undefined,
        genotype: snpData.genotype || undefined, // User's actual genotype
        phenotypes: snpData.phenotypes.map((p) => ({
          genotype: p.riskAllele || '',
          magnitude: p.effectSize || undefined,
          summary: p.phenotype,
        })),
      });

      // Store the new interpretation
      await this.storeInterpretation(snpId, aiInterpretation);
    }

    this.logger.log(`Generated personalized AI interpretation for ${snpId}`);

    return {
      snpData,
      aiInterpretation,
    };
  }

  /**
   * Force regenerate and store AI interpretation for a SNP
   */
  async regenerateInterpretation(snpId: string): Promise<any> {
    this.logger.log(`Force regenerating interpretation for SNP ${snpId}`);

    const snpData = await this.prisma.snp.findUnique({
      where: { rsid: snpId },
      include: {
        phenotypes: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!snpData) {
      throw new Error(`SNP ${snpId} not found in database`);
    }

    // Generate new AI interpretation
    const aiInterpretation = await this.aiService.interpretSnpData({
      rsid: snpData.rsid,
      gene: snpData.gene || undefined,
      summary: snpData.summary || undefined,
      magnitude: snpData.magnitude || undefined,
      genotype: snpData.genotype || undefined,
      phenotypes: snpData.phenotypes.map((p) => ({
        genotype: p.riskAllele || '',
        magnitude: p.effectSize || undefined,
        summary: p.phenotype,
      })),
    });

    // Store the new interpretation
    await this.storeInterpretation(snpId, aiInterpretation);

    this.logger.log(`Successfully regenerated interpretation for ${snpId}`);

    return aiInterpretation;
  }

  /**
   * Get stored interpretation from database
   */
  async getStoredInterpretation(snpId: string): Promise<any | null> {
    const snpData = await this.prisma.snp.findUnique({
      where: { rsid: snpId },
      select: {
        interpretation: true,
        interpretationGeneratedAt: true,
      },
    });

    if (!snpData || !snpData.interpretation) {
      return null;
    }

    try {
      const interpretation = JSON.parse(snpData.interpretation);
      return {
        ...interpretation,
        generatedAt: snpData.interpretationGeneratedAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to parse stored interpretation for ${snpId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get comprehensive SNP data by RSID
   */
  async getSnpData(snpId: string): Promise<any> {
    const snpData = await this.prisma.snp.findUnique({
      where: { rsid: snpId },
      include: {
        phenotypes: true,
        tags: {
          include: {
            tag: true,
          },
        },
        drugInteractions: true,
      },
    });

    if (!snpData) {
      throw new Error(`SNP ${snpId} not found in database`);
    }

    // Parse stored interpretation if available
    let parsedInterpretation = null;
    if (snpData.interpretation) {
      try {
        parsedInterpretation = JSON.parse(snpData.interpretation);
      } catch (error) {
        this.logger.warn(`Failed to parse stored interpretation for ${snpId}`);
      }
    }

    return {
      ...snpData,
      parsedInterpretation,
      hasSnpediaParsedData: !!snpData.snpediaParsedData,
      snpediaLastFetched: snpData.snpediaLastFetched,
    };
  }

  /**
   * Search SNPs by gene name
   */
  async getSnpsByGene(gene: string): Promise<any[]> {
    return await this.prisma.snp.findMany({
      where: {
        gene: {
          contains: gene,
          mode: 'insensitive',
        },
      },
      include: {
        phenotypes: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  /**
   * Get risk analysis based on stored genotype data
   */
  async getRiskAnalysis(snpId: string): Promise<{
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    magnitude: number | null;
    userGenotype: string | null;
    interpretation: string;
  }> {
    const snpData = await this.getSnpData(snpId);

    if (!snpData.genotype) {
      return {
        riskLevel: 'UNKNOWN',
        magnitude: snpData.magnitude,
        userGenotype: null,
        interpretation: 'No genotype data available for risk assessment',
      };
    }

    // Find matching phenotype for user's genotype
    const matchingPhenotype = snpData.phenotypes.find(
      (p: any) => p.riskAllele === snpData.genotype,
    );

    const magnitude = matchingPhenotype?.effectSize || snpData.magnitude || 0;

    let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (magnitude >= 3) riskLevel = 'HIGH';
    else if (magnitude >= 2) riskLevel = 'MEDIUM';

    return {
      riskLevel,
      magnitude,
      userGenotype: snpData.genotype,
      interpretation:
        matchingPhenotype?.phenotype ||
        snpData.summary ||
        'No interpretation available',
    };
  }

  /**
   * Get complete SNPedia parsed data for a SNP
   */
  async getSnpediaParsedData(
    snpId: string,
  ): Promise<ComprehensiveSnpData | null> {
    const snpData = await this.prisma.snp.findUnique({
      where: { rsid: snpId },
      select: {
        snpediaParsedData: true,
        snpediaLastFetched: true,
      },
    });

    if (!snpData || !snpData.snpediaParsedData) {
      return null;
    }

    return snpData.snpediaParsedData as unknown as ComprehensiveSnpData;
  }

  /**
   * Check if SNPedia data needs to be refreshed (older than 30 days)
   */
  async shouldRefreshSnpediaData(snpId: string): Promise<boolean> {
    const snpData = await this.prisma.snp.findUnique({
      where: { rsid: snpId },
      select: {
        snpediaLastFetched: true,
      },
    });

    if (!snpData || !snpData.snpediaLastFetched) {
      return true; // No data or no fetch date, should refresh
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return snpData.snpediaLastFetched < thirtyDaysAgo;
  }
}
