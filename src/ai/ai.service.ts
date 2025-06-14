import { Injectable, Logger } from '@nestjs/common';
import { ollama } from 'ollama-ai-provider';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { AI_CONFIG } from './ai.config';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model = ollama(AI_CONFIG.ollama.model);

  constructor() {
    this.logger.log(
      `AI Service initialized with Ollama model: ${AI_CONFIG.ollama.model}`,
    );
    this.logger.log(`Ollama base URL: ${AI_CONFIG.ollama.baseUrl}`);
  }

  /**
   * Generate text using the Ollama model
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.model,
        prompt,
      });
      return text;
    } catch (error) {
      this.logger.error('Error generating text:', error);
      throw new Error(`Failed to generate text: ${error.message}`);
    }
  }

  /**
   * Generate structured object using schema validation
   */
  async generateObject<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T> {
    try {
      const { object } = await generateObject({
        model: this.model,
        schema,
        prompt,
      });
      return object;
    } catch (error) {
      this.logger.error('Error generating object:', error);
      throw new Error(`Failed to generate object: ${error.message}`);
    }
  }

  /**
   * Analyze genetic evidence and resolve conflicts using AI
   * This method implements the evidence resolution framework from your project requirements
   */
  async resolveGeneticEvidence(evidenceData: any): Promise<any> {
    const schema = z.object({
      weightedEffect: z
        .number()
        .describe('Weighted effect size considering all evidence'),
      consistencyScore: z
        .number()
        .min(0)
        .max(1)
        .describe('Score from 0-1 indicating consistency across studies'),
      interpretation: z
        .string()
        .describe('Clear interpretation of the genetic evidence'),
      confidence: z
        .enum(['high', 'moderate', 'low'])
        .describe('Confidence level in the interpretation'),
      actionableInsights: z
        .array(z.string())
        .describe('Specific actionable recommendations based on the evidence'),
    });

    const prompt = `
    You are a genetics expert analyzing genetic evidence for a specific variant.
    
    Evidence data: ${JSON.stringify(evidenceData, null, 2)}
    
    Please analyze this genetic evidence and provide:
    1. A weighted effect considering study quality, sample size, and consistency
    2. A consistency score (0-1) based on how well studies agree
    3. A clear interpretation that explains what this means for health
    4. Confidence level (high/moderate/low) based on evidence quality
    5. Specific actionable insights or recommendations
    
    Focus on being scientifically accurate while making the information understandable and actionable.
    `;

    return this.generateObject(prompt, schema);
  }

  /**
   * Interpret SNP data with context and user's specific genotype
   */
  async interpretSnpData(snpData: {
    rsid: string;
    gene?: string;
    summary?: string;
    magnitude?: number;
    genotype?: string; // User's actual genotype
    phenotypes: Array<{
      genotype: string;
      magnitude?: number;
      summary?: string;
    }>;
  }): Promise<{
    interpretation: string;
    riskLevel: 'low' | 'moderate' | 'high';
    recommendations: string[];
    personalizedAnalysis: string;
    applicableTraits: string[];
    importance: 'critical' | 'high' | 'moderate' | 'low' | 'minimal';
    attentionStatus: 'requires_immediate_attention' | 'requires_monitoring' | 'beneficial_variant' | 'normal_population' | 'insufficient_data' | 'common_benign' | 'pharmacogenomic' | 'carrier_status';
  }> {
    const schema = z.object({
      interpretation: z
        .string()
        .describe('Clear explanation of what this SNP means for health'),
      riskLevel: z
        .enum(['low', 'moderate', 'high'])
        .describe('Overall risk level based on the genetic variant'),
      recommendations: z
        .array(z.string())
        .describe('Specific actionable health recommendations'),
      personalizedAnalysis: z
        .string()
        .describe(
          "Personalized analysis based on the user's specific genotype",
        ),
      applicableTraits: z
        .array(z.string())
        .describe(
          "Traits and health effects that specifically apply to this user's genotype",
        ),
      importance: z
        .enum(['critical', 'high', 'moderate', 'low', 'minimal'])
        .describe('How important this SNP is for the individual to know about and act upon'),
      attentionStatus: z
        .enum([
          'requires_immediate_attention',
          'requires_monitoring', 
          'beneficial_variant',
          'normal_population',
          'insufficient_data',
          'common_benign',
          'pharmacogenomic',
          'carrier_status'
        ])
        .describe('Status indicating the type of attention this SNP requires based on personal genotype'),
    });

    // Find the matching phenotype for the user's genotype
    const userPhenotype = snpData.phenotypes.find(
      (p) => p.genotype === snpData.genotype,
    );

    const prompt = `
    You are a genetics expert providing personalized genomic analysis. Analyze this genetic variant and provide a comprehensive, personalized interpretation.
    
    SNP Information:
    - SNP ID: ${snpData.rsid}
    - Gene: ${snpData.gene || 'Unknown'}
    - Summary: ${snpData.summary || 'No summary available'}
    - Overall Magnitude: ${snpData.magnitude || 'Not specified'}
    
    USER'S GENOTYPE: ${snpData.genotype || 'Not specified'}
    
    Available genotype-specific data:
    ${snpData.phenotypes.map((p) => `- ${p.genotype}: ${p.summary || 'No description'} (magnitude: ${p.magnitude || 'N/A'})`).join('\n')}
    
    ${userPhenotype ? `\nSPECIFIC MATCH FOR USER'S GENOTYPE (${snpData.genotype}):\n- Summary: ${userPhenotype.summary || 'No specific description'}\n- Magnitude: ${userPhenotype.magnitude || 'N/A'}` : "\nNote: No specific data found for user's genotype."}
    
    Please provide:
    1. A clear interpretation of what this genetic variant means for health in general
    2. An overall risk level assessment (low/moderate/high)
    3. Specific actionable health recommendations
    4. PERSONALIZED ANALYSIS: Focus specifically on what this means for someone with the genotype "${snpData.genotype}". Explain how this person's specific genetic variant affects their health, traits, or disease risk.
    5. APPLICABLE TRAITS: List the specific traits, conditions, or health effects that apply to this user's genotype.
    6. IMPORTANCE LEVEL: Rate how important this SNP is for this individual to know about and act upon:
       - critical: Life-threatening conditions, major disease risks requiring immediate medical attention
       - high: Significant health impact, preventable conditions, major drug responses
       - moderate: Notable health effects, lifestyle modifications beneficial
       - low: Minor traits or small effect sizes
       - minimal: Common variants with little practical impact
    7. ATTENTION STATUS: Choose the most appropriate status based on the user's genotype:
       - requires_immediate_attention: High-risk pathogenic variants needing urgent medical consultation
       - requires_monitoring: Increased disease risk warranting regular screening
       - beneficial_variant: Protective variants or positive traits
       - normal_population: Common genotype similar to general population
       - insufficient_data: Limited evidence or conflicting studies
       - common_benign: Very common variant with no significant health impact
       - pharmacogenomic: Important for drug metabolism or response
       - carrier_status: Carrier for recessive conditions (important for family planning)
    
    Be specific about the user's genotype and avoid generic advice. Focus on evidence-based, personalized insights that are directly relevant to their genetic makeup.
    
    IMPORTANT: Base the importance and attention status specifically on THIS USER'S GENOTYPE (${snpData.genotype}), not on the general SNP. A SNP might be critical in general but if this user has the normal/common variant, it should be rated as normal_population or common_benign.
    `;

    return this.generateObject(prompt, schema);
  }

  /**
   * Generate personalized health recommendations based on multiple genetic factors
   */
  async generatePersonalizedRecommendations(
    geneticProfile: any,
    userContext?: {
      age?: number;
      ancestry?: string;
      familyHistory?: string[];
    },
  ): Promise<{
    recommendations: string[];
    priorityAreas: string[];
    monitoringAdvice: string[];
  }> {
    const schema = z.object({
      recommendations: z
        .array(z.string())
        .describe('Personalized health recommendations'),
      priorityAreas: z
        .array(z.string())
        .describe('Key health areas to prioritize based on genetics'),
      monitoringAdvice: z
        .array(z.string())
        .describe('Specific monitoring or testing recommendations'),
    });

    const prompt = `
    Generate personalized health recommendations based on this genetic profile:
    
    Genetic Data: ${JSON.stringify(geneticProfile, null, 2)}
    
    User Context:
    - Age: ${userContext?.age || 'Not specified'}
    - Ancestry: ${userContext?.ancestry || 'Not specified'}
    - Family History: ${userContext?.familyHistory?.join(', ') || 'Not specified'}
    
    Please provide:
    1. Specific, actionable health recommendations
    2. Priority health areas to focus on
    3. Monitoring or testing advice
    
    Ensure recommendations are evidence-based, personalized, and practical.
    `;

    return this.generateObject(prompt, schema);
  }
}
