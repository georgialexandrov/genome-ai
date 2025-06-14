import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';
import parseMediawikiTemplate from 'parse-mediawiki-template';

// Input interface for the service
export interface SnpediaInput {
  text: string; // HTML content
  wikitext: string; // MediaWiki template content
}

// Comprehensive SNP data interface
export interface ComprehensiveSnpData {
  // Primary identification (MediaWiki priority)
  rsid?: string;
  gene?: string;
  chromosome?: string;
  position?: number;

  // Risk and effect information
  summary?: string;
  genotypes: GenotypeInfo[];
  maxMagnitude?: number;
  riskAllele?: string;

  // Clinical data
  clinicalInfo?: ClinicalInfo;
  clinvarData?: any;
  omimData?: any;

  // Population and frequency data
  populationData?: PopulationData;
  gmaf?: number;

  // External references
  externalLinks: ExternalLink[];
  pmids: PmidInfo[];

  // Metadata
  orientation?: string;
  referenceAllele?: string;
  assembly?: string;
  dbSNPBuild?: string;

  // Additional parsed data
  traits: string[];
  genotypeEffects: GenotypeEffect[];
  relatedSNPs: string[];
  genderSpecific?: string;

  // Data quality indicators
  sourceData: {
    hasHtmlData: boolean;
    hasTemplateData: boolean;
    genotypeCount: number;
    externalLinkCount: number;
  };

  // Raw content storage
  rawContent?: {
    html?: string;
    wikitext?: string;
  };
}

export interface PmidInfo {
  pmid: string;
  title?: string;
}

export interface GenotypeInfo {
  genotype: string;
  magnitude: number;
  summary: string;
  color?: string;
}

export interface GenotypeEffect {
  genotype: string;
  effect: string;
  context?: string;
}

export interface ExternalLink {
  name: string;
  url: string;
}

export interface PopulationData {
  populations: string[];
  frequencies: { [population: string]: { [genotype: string]: number } };
}

export interface ClinicalInfo {
  significance?: string;
  disease?: string;
  omimId?: string;
  clinvarData?: any;
}

@Injectable()
export class SnpediaParserService {
  /**
   * Main method: Parse SNPedia content from HTML and WikiText
   * MediaWiki template data has priority over HTML data
   */
  parseSnpediaContent(input: SnpediaInput): ComprehensiveSnpData {
    // Parse both sources
    const htmlData = this.parseHtmlContent(input.text);
    const wikiData = this.parseWikiTemplates(input.wikitext);
    const contentData = this.parseContentText(input.wikitext);
    console.log({
      htmlData: JSON.stringify(htmlData, null, 2),
      wikiData: JSON.stringify(wikiData, null, 2),
    });
    
    // Merge with MediaWiki data taking priority
    const mergedData = this.mergeSnpData(htmlData, wikiData, contentData);
    
    // Add raw content
    mergedData.rawContent = {
      html: input.text,
      wikitext: input.wikitext,
    };
    
    return mergedData;
  }

  /**
   * Parse HTML content using Cheerio
   */
  private parseHtmlContent(html: string): Partial<ComprehensiveSnpData> {
    const $ = load(html);

    const result: Partial<ComprehensiveSnpData> = {
      genotypes: [],
      externalLinks: [],
      pmids: [],
      traits: [],
      genotypeEffects: [],
      relatedSNPs: [],
    };

    // Extract basic info
    this.extractBasicInfoFromHtml(result, $);

    // Extract genotype table
    this.extractGenotypeInfoFromHtml(result, $);

    // Extract external links
    this.extractExternalLinksFromHtml(result, $);

    // Extract PMIDs
    this.extractPmidsFromHtml(result, $);

    // Extract population data
    this.extractPopulationDataFromHtml(result, $);

    // Extract clinical info
    this.extractClinicalInfoFromHtml(result, $);

    return result;
  }

  /**
   * Parse MediaWiki templates
   */
  private parseWikiTemplates(wikitext: string): any {
    const rsnum = parseMediawikiTemplate(wikitext, 'rsnum');
    const pmidAuto = parseMediawikiTemplate(wikitext, 'PMID Auto');
    const pmid = parseMediawikiTemplate(wikitext, 'PMID');
    const populationDiversity = parseMediawikiTemplate(
      wikitext,
      'population diversity',
    );
    const clinvar = parseMediawikiTemplate(wikitext, 'ClinVar');
    const onchip = parseMediawikiTemplate(wikitext, 'on chip');
    const omim = parseMediawikiTemplate(wikitext, 'omim');

    return {
      rsnum: Array.isArray(rsnum) ? rsnum[0] : rsnum,
      pmidAuto: Array.isArray(pmidAuto) ? pmidAuto : pmidAuto,
      pmid: Array.isArray(pmid) ? pmid : pmid,
      populationDiversity: Array.isArray(populationDiversity)
        ? populationDiversity[0]
        : populationDiversity,
      clinvar: Array.isArray(clinvar) ? clinvar[0] : clinvar,
      onchip: Array.isArray(onchip) ? onchip : onchip,
      omim: Array.isArray(omim) ? omim[0] : omim,
    };
  }

  /**
   * Parse free text content from MediaWiki
   */
  private parseContentText(text: string): any {
    const result = {
      traits: [] as string[],
      genotypeEffects: [] as GenotypeEffect[],
      relatedSNPs: [] as string[],
      pmids: [] as PmidInfo[],
      riskAllele: undefined as string | undefined,
      genderSpecific: undefined as string | undefined,
      clinicalSignificance: [] as string[],
    };

    // Extract risk allele
    const riskAlleleMatch = text.match(
      /(?:risk allele|risk variant) is \(([^)]+)\)/i,
    );
    if (riskAlleleMatch) {
      result.riskAllele = riskAlleleMatch[1];
    }

    // Extract traits/conditions (content in [[brackets]])
    const traitMatches = text.match(/\[\[([^\]]+)\]\]/g);
    if (traitMatches) {
      result.traits = [
        ...new Set(
          traitMatches.map((match) =>
            match.replace(/^\[\[|\]\]$/g, '').toLowerCase(),
          ),
        ),
      ];
    }

    // Extract genotype-specific effects
    const genotypeMatches = text.match(/\[\[rs\d+\(([^)]+)\)\]\]/g);
    if (genotypeMatches) {
      genotypeMatches.forEach((match) => {
        const genotypeMatch = match.match(/\[\[rs\d+\(([^)]+)\)\]\]/);
        if (genotypeMatch) {
          const index = text.indexOf(match);
          const contextStart = Math.max(0, index - 100);
          const contextEnd = Math.min(text.length, index + 100);
          const context = text.substring(contextStart, contextEnd).trim();

          result.genotypeEffects.push({
            genotype: genotypeMatch[1],
            effect: context,
            context: context,
          });
        }
      });
    }

    // Extract related SNPs
    const relatedSnpMatches = text.match(/\[\[rs\d+\]\]/g);
    if (relatedSnpMatches) {
      result.relatedSNPs = [
        ...new Set(
          relatedSnpMatches.map((match) => match.replace(/^\[\[|\]\]$/g, '')),
        ),
      ];
    }

    // Extract PMIDs with titles
    const pmidMatches = text.match(/\{\{PMID\|(\d+)([^}]*)\}\}/g);
    if (pmidMatches) {
      result.pmids = pmidMatches
        .map((match) => {
          const pmidMatch = match.match(/\{\{PMID\|(\d+)([^}]*)\}\}/);
          if (pmidMatch) {
            const pmid = pmidMatch[1];
            const titlePart = pmidMatch[2];

            // Extract title if it exists (format might be |title=... or just |...)
            let title: string | undefined;
            if (titlePart) {
              const titleMatch = titlePart.match(/\|(?:title=)?([^|]+)/);
              if (titleMatch) {
                title = titleMatch[1].trim();
              }
            }

            return { pmid, title } as PmidInfo;
          }
          return null;
        })
        .filter((item): item is PmidInfo => item !== null);
    }

    // Extract gender specificity
    if (
      text.includes('primarily seen only in males') ||
      text.includes('X chromosome')
    ) {
      result.genderSpecific = 'male';
    }
    if (text.includes('females') && text.includes('homozygous')) {
      result.genderSpecific = result.genderSpecific ? 'both' : 'female';
    }

    // Extract clinical significance (P values)
    if (text.includes('P value')) {
      const pValueMatches = text.match(/P(?:\s+value)?[=\s]*([0-9.e\-×÷]+)/gi);
      if (pValueMatches) {
        result.clinicalSignificance = pValueMatches.map(
          (match) => `Statistical significance: ${match}`,
        );
      }
    }

    return result;
  }

  /**
   * Extract basic SNP information from HTML
   */
  private extractBasicInfoFromHtml(
    result: Partial<ComprehensiveSnpData>,
    $: any,
  ): void {
    // Extract from key-value tables
    $('table').each((_: any, table: any) => {
      const $table = $(table);
      $table.find('tr').each((_: any, row: any) => {
        const $row = $(row);
        const cells = $row.find('td');

        if (cells.length === 2) {
          const key = $(cells[0]).text().trim().toLowerCase();
          const value = $(cells[1]).text().trim();

          switch (key) {
            case 'chromosome':
              result.chromosome = value;
              break;
            case 'position':
              result.position = parseInt(value.replace(/,/g, ''));
              break;
            case 'gene':
              result.gene = $(cells[1]).find('a').text() || value;
              break;
            case 'gmaf':
              result.gmaf = parseFloat(value);
              break;
            case 'orientation':
              result.orientation = value;
              break;
          }
        }
      });
    });

    // Extract summary from the first colored table
    const summaryTable = $('table[style*="background-color: #FFFFC0"]').first();
    if (summaryTable.length) {
      result.summary = summaryTable.find('td').text().trim();
    }

    // Extract RSID from page content or URL patterns
    const rsidMatch = $.html().match(/rs(\d+)/);
    if (rsidMatch) {
      result.rsid = `rs${rsidMatch[1]}`;
    }
  }

  /**
   * Extract genotype-magnitude table from HTML
   */
  private extractGenotypeInfoFromHtml(
    result: Partial<ComprehensiveSnpData>,
    $: any,
  ): void {
    if (!result.genotypes) result.genotypes = [];

    // Find the genotype table with Geno/Mag/Summary columns
    $('table.sortable.smwtable, table').each((_: any, table: any) => {
      const $table = $(table);
      const headers = $table
        .find('th')
        .map((_: any, th: any) => $(th).text().trim().toLowerCase())
        .get();

      if (
        headers.includes('geno') &&
        headers.includes('mag') &&
        headers.includes('summary')
      ) {
        $table.find('tr').each((_: any, row: any) => {
          const $row = $(row);
          const cells = $row.find('td');

          if (cells.length >= 3) {
            const genotype = $(cells[0]).text().trim().replace(/[()]/g, '');
            const magnitude = parseFloat($(cells[1]).text().trim());
            const summary = $(cells[2]).text().trim();

            // Extract background color for risk indication
            const bgColor = $(cells[1]).attr('style');
            let color = 'unknown';
            if (bgColor?.includes('#80ff80'))
              color = 'green'; // Low risk
            else if (bgColor?.includes('#ffffff'))
              color = 'white'; // Medium risk
            else if (bgColor?.includes('#ff8080')) color = 'red'; // High risk

            if (genotype && !isNaN(magnitude)) {
              result.genotypes!.push({
                genotype,
                magnitude,
                summary,
                color,
              });
            }
          }
        });
      }
    });
  }

  /**
   * Extract external database links from HTML
   */
  private extractExternalLinksFromHtml(
    result: Partial<ComprehensiveSnpData>,
    $: any,
  ): void {
    if (!result.externalLinks) result.externalLinks = [];

    // Extract external database links
    $('table').each((_: any, table: any) => {
      const $table = $(table);
      $table.find('tr').each((_: any, row: any) => {
        const $row = $(row);
        const cells = $row.find('td');

        if (cells.length === 2) {
          const name = $(cells[0]).text().trim();
          const link = $(cells[1]).find('a[href]').attr('href');

          if (link && link.startsWith('http')) {
            result.externalLinks!.push({ name, url: link });
          }
        }
      });
    });
  }

  /**
   * Extract PMIDs from HTML content
   */
  private extractPmidsFromHtml(
    result: Partial<ComprehensiveSnpData>,
    $: any,
  ): void {
    if (!result.pmids) result.pmids = [];

    // Extract PMIDs from links to PubMed
    $('a[href*="pubmed"]').each((_: any, link: any) => {
      const href = $(link).attr('href');
      const text = $(link).text().trim();

      if (href) {
        const pmidMatch = href.match(/(?:pubmed\/|pmid[=:]?)(\d+)/i);
        if (pmidMatch) {
          const pmid = pmidMatch[1];

          // Try to extract title from the link text or surrounding context
          let title: string | undefined;
          if (text && text !== pmid && !text.match(/^\d+$/)) {
            title = text;
          } else {
            // Try to get title from parent or sibling elements
            const parent = $(link).parent();
            const siblingText = parent.text().replace(text, '').trim();
            if (siblingText && siblingText.length > 10) {
              title = siblingText;
            }
          }

          // Check if this PMID already exists
          const existingPmid = result.pmids!.find((p) => p.pmid === pmid);
          if (!existingPmid) {
            result.pmids!.push({ pmid, title });
          } else if (title && !existingPmid.title) {
            // Update existing PMID with title if it didn't have one
            existingPmid.title = title;
          }
        }
      }
    });
  }

  /**
   * Extract population diversity data from HTML
   */
  private extractPopulationDataFromHtml(
    result: Partial<ComprehensiveSnpData>,
    $: any,
  ): void {
    // Look for population diversity data in scripts
    const scriptContent = $('script').text();
    const labelsMatch = scriptContent.match(/var labels = \[(.*?)\]/);
    const seriesMatch = scriptContent.match(/var series = (\[.*?\]);/s);

    if (labelsMatch && seriesMatch) {
      try {
        const labels = JSON.parse(`[${labelsMatch[1]}]`);
        const series = JSON.parse(seriesMatch[1]);

        const populationData: PopulationData = {
          populations: labels,
          frequencies: {},
        };

        labels.forEach((pop: string, idx: number) => {
          populationData.frequencies[pop] = {};
          series.forEach((genotypeSeries: any, genoIdx: number) => {
            const frequency = parseFloat(
              genotypeSeries.data[idx]?.value || '0',
            );
            populationData.frequencies[pop][`geno${genoIdx + 1}`] = frequency;
          });
        });

        result.populationData = populationData;
      } catch (e) {
        console.warn('Failed to parse population data:', e);
      }
    }
  }

  /**
   * Extract clinical information from HTML
   */
  private extractClinicalInfoFromHtml(
    result: Partial<ComprehensiveSnpData>,
    $: any,
  ): void {
    const clinicalInfo: ClinicalInfo = {};

    // Extract ClinVar information
    $('table').each((_: any, table: any) => {
      const $table = $(table);
      const clinvarHeader = $table.find('th:contains("ClinVar")');

      if (clinvarHeader.length) {
        $table.find('tr').each((_: any, row: any) => {
          const $row = $(row);
          const cells = $row.find('td, th');

          if (cells.length === 2) {
            const key = $(cells[0]).text().trim().toLowerCase();
            const value = $(cells[1]).text().trim();

            switch (key) {
              case 'significance':
                clinicalInfo.significance = value;
                break;
              case 'disease':
                clinicalInfo.disease = value;
                break;
            }
          }
        });
      }
    });

    // Extract OMIM information
    const omimLink = $('a[href*="omim"]').attr('href');
    if (omimLink) {
      const omimMatch = omimLink.match(/omim\/(\d+)/);
      if (omimMatch) {
        clinicalInfo.omimId = omimMatch[1];
      }
    }

    if (Object.keys(clinicalInfo).length > 0) {
      result.clinicalInfo = clinicalInfo;
    }
  }

  /**
   * Merge HTML and MediaWiki data with MediaWiki taking priority
   */
  private mergeSnpData(
    htmlData: Partial<ComprehensiveSnpData>,
    wikiData: any,
    contentData: any,
  ): ComprehensiveSnpData {
    const rsnumData = wikiData.rsnum || {};
    const clinvarData = wikiData.clinvar || {};
    const omimData = wikiData.omim || {};

    return {
      // Primary identification (MediaWiki priority)
      rsid: 'rs' + rsnumData.rsid || htmlData.rsid,
      gene: rsnumData.Gene || htmlData.gene,
      chromosome: rsnumData.Chromosome || htmlData.chromosome,
      position: rsnumData.position
        ? parseInt(rsnumData.position)
        : htmlData.position,

      // Risk and effect information
      summary: rsnumData.Summary || htmlData.summary,
      genotypes: htmlData.genotypes || [],
      maxMagnitude: htmlData.maxMagnitude,
      riskAllele: contentData.riskAllele,

      // Clinical data
      clinicalInfo: htmlData.clinicalInfo,
      clinvarData: clinvarData,
      omimData: omimData,

      // Population and frequency data
      populationData: htmlData.populationData,
      gmaf: rsnumData.GMAF ? parseFloat(rsnumData.GMAF) : htmlData.gmaf,

      // External references
      externalLinks: htmlData.externalLinks || [],
      pmids: [
        ...(htmlData.pmids || []),
        ...(contentData.pmids || []),
        ...(wikiData.pmidAuto?.map((p: any) => ({
          pmid: p.PMID,
          title: p.title,
        })) || []),
        ...(wikiData.pmid?.map((p: any) => ({
          pmid: typeof p === 'string' ? p : p.PMID,
          title: typeof p === 'object' ? p.title : undefined,
        })) || []),
      ].filter((v, i, a) => a.findIndex((item) => item.pmid === v.pmid) === i), // Remove duplicates by PMID

      // Metadata (MediaWiki priority)
      orientation: rsnumData.Orientation || htmlData.orientation,
      referenceAllele: rsnumData.ReferenceAllele || htmlData.referenceAllele,
      assembly: rsnumData.Assembly,
      dbSNPBuild: rsnumData.dbSNPBuild,

      // Additional parsed data
      traits: contentData.traits || [],
      genotypeEffects: contentData.genotypeEffects || [],
      relatedSNPs: contentData.relatedSNPs || [],
      genderSpecific: contentData.genderSpecific,

      // Data quality indicators
      sourceData: {
        hasHtmlData: !!htmlData.rsid,
        hasTemplateData: !!rsnumData.rsid,
        genotypeCount: htmlData.genotypes?.length || 0,
        externalLinkCount: htmlData.externalLinks?.length || 0,
      },
    };
  }

  /**
   * Analyze risk levels based on genotype magnitudes
   */
  analyzeRiskLevels(data: ComprehensiveSnpData): Array<{
    genotype: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    magnitude: number;
    summary: string;
  }> {
    return data.genotypes.map((geno) => ({
      genotype: geno.genotype,
      riskLevel:
        geno.magnitude >= 3 ? 'HIGH' : geno.magnitude >= 2 ? 'MEDIUM' : 'LOW',
      magnitude: geno.magnitude,
      summary: geno.summary,
    }));
  }
}
