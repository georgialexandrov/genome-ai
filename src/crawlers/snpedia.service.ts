import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const wtf = require('wtf_wikipedia');

interface SnpTemplateData {
  template?: string; // Name of the template, e.g., 'Rsnum'
  rsid?: string;
  Gene?: string;
  Chromosome?: string;
  position?: string;
  Orientation?: string;
  StabilizedOrientation?: string;
  ReferenceAllele?: string;
  GMAF?: string;
  Gene_s?: string;
  Assembly?: string;
  GenomeBuild?: string;
  dbSNPBuild?: string;
  Summary?: string; // Overall summary for the SNP page
  magnitude?: string; // Overall magnitude for the SNP

  // Genotype specific fields, e.g., geno1, mag1, sum1
  geno1?: string;
  mag1?: string;
  sum1?: string;
  geno2?: string;
  mag2?: string;
  sum2?: string;
  geno3?: string;
  mag3?: string;
  sum3?: string;
  geno4?: string;
  mag4?: string;
  sum4?: string;
  geno5?: string;
  mag5?: string;
  sum5?: string;
  // Add more if more genotypes are common, or handle dynamically if possible
  [key: string]: any; // Allow other properties, like description if Summary is not present
}

// Define an interface for the expected SNPedia API response
interface SnpediaPage {
  pageid: number;
  ns: number;
  title: string;
  revisions?: [
    {
      contentformat: string;
      contentmodel: string;
      '*': string;
    },
  ];
  missing?: string;
}

interface SnpediaQuery {
  pages: {
    [pageId: string]: SnpediaPage;
  };
}

interface SnpediaResponse {
  batchcomplete: string;
  query: SnpediaQuery;
}

interface ParsedPhenotype {
  genotype: string;
  magnitude?: number | null;
  summary?: string;
}

interface ParsedSnpData {
  summary?: string; // Overall summary for the SNP
  magnitude?: number | null; // Overall magnitude for the SNP
  gene?: string;
  phenotypes: ParsedPhenotype[]; // Changed to non-optional, will be empty array if none found
  sourceTemplate: 'Rsnum' | 'fallback' | 'none'; // To indicate how data was derived
}

@Injectable()
export class SnpediaService {
  private readonly logger = new Logger(SnpediaService.name);
  private prisma = new PrismaClient();
  private readonly baseUrl = 'https://bots.snpedia.com/api.php';

  private parseSnpediaContent(wikitext: string): ParsedSnpData {
    const doc = wtf(wikitext);
    const parsedResult: ParsedSnpData = {
      phenotypes: [],
      sourceTemplate: 'none',
    };

    const rsnumTemplate = doc
      .templates()

      .find((t) => t.wikitext().toLowerCase().startsWith('{{rsnum'));

    if (rsnumTemplate) {
      parsedResult.sourceTemplate = 'Rsnum';
      // @ts-ignore
      const templateData = rsnumTemplate.json() as SnpTemplateData;

      parsedResult.gene = templateData.Gene;
      parsedResult.summary = templateData.Summary || templateData.description;

      if (templateData.magnitude) {
        const mag = parseFloat(templateData.magnitude);
        if (!isNaN(mag)) {
          parsedResult.magnitude = mag;
        }
      }

      for (let i = 1; i <= 5; i++) {
        // Check for up to 5 genotypes
        const genotype = templateData[`geno${i}` as keyof SnpTemplateData] as
          | string
          | undefined;
        const magnitudeStr = templateData[
          `mag${i}` as keyof SnpTemplateData
        ] as string | undefined;
        const summary = templateData[`sum${i}` as keyof SnpTemplateData] as
          | string
          | undefined;

        if (genotype) {
          const phenotype: ParsedPhenotype = { genotype };
          if (magnitudeStr) {
            const mag = parseFloat(magnitudeStr);
            if (!isNaN(mag)) {
              phenotype.magnitude = mag;
            }
          }
          if (summary) {
            phenotype.summary = summary;
          }
          parsedResult.phenotypes.push(phenotype);
        } else {
          // If genoX is not found, assume no more genotypes in this simple indexed format
          // More complex templates might list genotypes differently
        }
      }
      // If no genoX/magX/sumX fields, check for table based genotype info if Rsnum was found
      if (parsedResult.phenotypes.length === 0) {
        const tables = doc.tables();
        if (tables && tables.length > 0) {
          // @ts-ignore
          tables.forEach((table: any) => {
            const tableData = table.json() as Array<Record<string, any>>;
            if (tableData && tableData.length > 0) {
              // Check if table has Geno, Mag, Summary headers (case-insensitive)
              const header = tableData[0];
              const genoHeader = Object.keys(header).find(
                (k) => k.toLowerCase() === 'geno',
              );
              const magHeader = Object.keys(header).find(
                (k) => k.toLowerCase() === 'mag',
              );
              const summaryHeader = Object.keys(header).find(
                (k) => k.toLowerCase() === 'summary',
              );

              if (genoHeader && magHeader && summaryHeader) {
                tableData.forEach((row: Record<string, any>) => {
                  const genotype = row[genoHeader]?.text || row[genoHeader];
                  const magnitudeStr = row[magHeader]?.text || row[magHeader];
                  const summary =
                    row[summaryHeader]?.text || row[summaryHeader];

                  if (genotype) {
                    const phenotype: ParsedPhenotype = {
                      genotype: String(genotype),
                    };
                    if (magnitudeStr) {
                      const mag = parseFloat(String(magnitudeStr));
                      if (!isNaN(mag)) {
                        phenotype.magnitude = mag;
                      }
                    }
                    if (summary) {
                      phenotype.summary = String(summary);
                    }
                    parsedResult.phenotypes.push(phenotype);
                  }
                });
              }
            }
          });
        }
      }
    } else {
      this.logger.warn(
        'Rsnum template not found. Attempting fallback parsing for basic info.',
      );
      parsedResult.sourceTemplate = 'fallback';
      const text = doc.text();
      const summaryMatch = text.match(/summary=([^\\n|]*)/i);
      if (summaryMatch && summaryMatch[1]) {
        parsedResult.summary = summaryMatch[1].trim();
      }
      const magnitudeMatch = text.match(/magnitude=([^\\n|]*)/i);
      if (magnitudeMatch && magnitudeMatch[1]) {
        const mag = parseFloat(magnitudeMatch[1].trim());
        if (!isNaN(mag)) parsedResult.magnitude = mag;
      }
      const geneMatch = text.match(/gene=([^\\n|]*)/i);
      if (geneMatch && geneMatch[1]) {
        parsedResult.gene = geneMatch[1].trim();
      }
    }

    // Clean undefined keys from the main structure, phenotypes are handled internally
    Object.keys(parsedResult).forEach(
      (key) =>
        parsedResult[key as keyof ParsedSnpData] === undefined &&
        delete parsedResult[key as keyof ParsedSnpData],
    );
    if (!parsedResult.phenotypes) parsedResult.phenotypes = []; // Ensure phenotypes is always an array

    return parsedResult;
  }

  async fetchAndStoreSnpData(snpId: string): Promise<void> {
    this.logger.log(`Fetching data for SNP ID: ${snpId}`);
    try {
      const response = await axios.get<SnpediaResponse>(this.baseUrl, {
        params: {
          action: 'query',
          titles: snpId,
          prop: 'revisions',
          rvprop: 'content',
          format: 'json',
        },
      });

      const pages = response.data.query.pages;
      const pageId = Object.keys(pages)[0];
      const pageData = pages[pageId];

      if (
        pageData.missing !== undefined ||
        !pageData.revisions ||
        pageData.revisions.length < 1 // Corrected array length check
      ) {
        this.logger.warn(
          `SNP ID ${snpId} not found or has no revisions on SNPedia.`,
        );
        return;
      }

      const content = pageData.revisions[0]['*'];
      this.logger.log(
        `Data fetched for ${snpId}, attempting to parse and store.`,
      );

      const parsedData = this.parseSnpediaContent(content);
      console.log({ parsedData: JSON.stringify(parsedData, null, 2) });
      this.logger.log(
        `Parsed data for ${snpId}: ${JSON.stringify(parsedData)}`,
      );

      const snpUpdateData: {
        summary?: string;
        magnitude?: number | null;
        gene?: string;
      } = {};

      if (parsedData.summary) snpUpdateData.summary = parsedData.summary;
      if (parsedData.magnitude !== undefined) {
        snpUpdateData.magnitude = parsedData.magnitude;
      }
      if (parsedData.gene) snpUpdateData.gene = parsedData.gene;

      await this.prisma.$transaction(async (tx) => {
        let snp = await tx.snp.findUnique({ where: { rsid: snpId } });

        if (snp) {
          if (Object.keys(snpUpdateData).length > 0) {
            snp = await tx.snp.update({
              where: { rsid: snpId },
              data: snpUpdateData,
            });
            this.logger.log(
              `Successfully updated SNP data for ${snpId} in the database.`,
            );
          } else {
            this.logger.log(`No new core SNP data to update for ${snpId}.`);
          }
        } else {
          snp = await tx.snp.create({
            data: {
              rsid: snpId,
              ...snpUpdateData,
            },
          });
          this.logger.log(
            `Successfully created SNP data for ${snpId} from SNPedia.`,
          );
        }

        // Handle phenotypes only if Rsnum template was the source
        if (parsedData.sourceTemplate === 'Rsnum') {
          this.logger.log(
            `Processing phenotypes for ${snpId} from Rsnum template data.`,
          );
          // Delete existing phenotypes for this SNP
          await tx.phenotype.deleteMany({ where: { rsid: snpId } });
          this.logger.log(`Deleted existing phenotypes for ${snpId}.`);

          if (parsedData.phenotypes && parsedData.phenotypes.length > 0) {
            for (const p of parsedData.phenotypes) {
              await tx.phenotype.create({
                data: {
                  rsid: snpId,
                  phenotype: p.summary || '', // Genotype-specific summary
                  riskAllele: p.genotype, // Genotype, e.g., (C;C)
                  effectSize: p.magnitude, // Genotype-specific magnitude
                },
              });
            }
            this.logger.log(
              `Created ${parsedData.phenotypes.length} new phenotypes for ${snpId}.`,
            );
          } else {
            this.logger.log(
              `No new phenotypes parsed from Rsnum template for ${snpId}.`,
            );
          }
        } else {
          this.logger.log(
            `Phenotypes for ${snpId} not processed as source was not Rsnum or no phenotypes found.`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `Error processing SNP ${snpId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
