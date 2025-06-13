export const AI_CONFIG = {
  // Ollama configuration
  ollama: {
    baseUrl: 'http://localhost:11434', // Default Ollama URL
    model: 'mistral-small:latest',
    timeout: 30000, // 30 seconds timeout
  },

  // AI prompt templates
  prompts: {
    snpInterpretation: `
You are a genetics expert analyzing genetic variants. Provide clear, scientific interpretations 
while making the information accessible to non-experts. Focus on:

1. Health implications based on established research
2. Actionable recommendations where appropriate
3. Uncertainty levels and confidence in findings
4. Avoid medical advice - focus on educational information

Be accurate, balanced, and helpful.
    `,

    evidenceResolution: `
You are analyzing potentially conflicting genetic evidence from multiple studies.
Consider factors like:

1. Study size and statistical power
2. Population ancestry and applicability
3. Replication across independent studies
4. Clinical vs research-grade evidence
5. Time since publication and methodology quality

Provide a balanced interpretation that acknowledges uncertainty where appropriate.
    `,
  },

  // Response formatting
  formatting: {
    maxResponseLength: 2000,
    includeReferences: true,
    confidenceThresholds: {
      high: 0.8,
      moderate: 0.5,
      low: 0.3,
    },
  },
};
