# Genome AI - Personal Genomic Analysis Tool

<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-NestJS-red.svg" alt="Built with NestJS" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-blue.svg" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/AI-Vercel%20AI%20SDK-black.svg" alt="Vercel AI SDK" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

A modern, AI-powered personal genomic analysis tool that processes 23andMe raw data to provide comprehensive health insights using cutting-edge genomics research and artificial intelligence.

## 🧬 Project Overview

Genome AI addresses the limitations of commercial genetic testing services by leveraging modern genomics research advances, including polygenic risk scores (PRS) and evidence-based interpretation frameworks. This tool analyzes significantly more genetic variants than commercial offerings while providing AI-powered interpretation and conflict resolution.

### Key Features

- **Comprehensive Analysis**: Process 10x more variants than commercial services
- **AI-Powered Interpretation**: Intelligent synthesis of conflicting genetic evidence
- **Pharmacogenomics**: Analysis of 200+ drug-gene interactions
- **Polygenic Risk Scores**: Modern statistical methods for disease risk assessment
- **SNPedia Integration**: Access to 100,000+ variant annotations
- **Evidence-Based**: Tiered evidence system with quality scoring

### Why Genome AI?

**2018 Problem**: Individual SNPs showed contradictory results leading to project abandonment
**2025 Solution**: Modern frameworks resolve conflicts through:
- Polygenic risk scores instead of single-variant analysis
- Meta-analyses with millions of participants
- AI-powered evidence synthesis and conflict resolution
- Actionable insights focused on pharmacogenomics and prevention

## 🏗️ Architecture

Built with a modular NestJS architecture:

```
src/
├── ai/                    # Vercel AI SDK integration
├── crawlers/              # SNPedia data extraction
├── parsers/               # Data processing and enrichment
├── raw-data-processing/   # 23andMe file processing
└── prisma/               # Database schema and models
```

### Tech Stack

- **Backend**: Node.js with NestJS framework
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Vercel AI SDK with OpenAI integration
- **Web Scraping**: Cheerio + Axios for SNPedia
- **Type Safety**: Full TypeScript implementation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- pnpm (recommended) or npm
- OpenAI API key (optional, for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd genome-ai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/genome_ai"
   OPENAI_API_KEY="your-openai-api-key" # Optional
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma db push
   
   # Optional: Open Prisma Studio to view database
   npx prisma studio
   ```

5. **Start the development server**
   ```bash
   pnpm run start:dev
   # or
   npm run start:dev
   ```

The API will be available at `http://localhost:3000`

## 📊 Usage

### Processing 23andMe Data

1. **Upload your 23andMe raw data file** (typically named `genome_*.txt`)
2. **Call the processing endpoint**:
   ```bash
   curl -X POST http://localhost:3000/raw-data-processing/process \
     -F "file=@your-genome-file.txt"
   ```

3. **View enriched results** through the API endpoints or database

### API Endpoints

- `POST /raw-data-processing/process` - Process 23andMe raw data
- `GET /crawlers/snpedia/:rsid` - Get SNPedia data for a specific variant
- `POST /ai/interpret` - Generate AI interpretation for genetic variants

## 🧪 Development

### Available Scripts

```bash
# Development
pnpm run start:dev        # Start with hot reload
pnpm run start:debug      # Start with debugging

# Building
pnpm run build           # Build for production
pnpm run start:prod      # Run production build

# Testing
pnpm run test            # Unit tests
pnpm run test:e2e        # End-to-end tests
pnpm run test:cov        # Test coverage

# Code Quality
pnpm run lint            # ESLint
pnpm run format          # Prettier formatting

# Database
npx prisma studio        # Visual database browser
npx prisma migrate dev   # Create and apply migration
npx prisma db push       # Push schema changes (development)
```

### Project Structure

```
genome-ai/
├── src/
│   ├── ai/                     # AI interpretation services
│   │   ├── ai.service.ts
│   │   ├── ai.module.ts
│   │   └── ai.config.ts
│   ├── crawlers/               # Data extraction services
│   │   ├── snpedia.service.ts
│   │   ├── snpedia.controller.ts
│   │   └── crawlers.module.ts
│   ├── parsers/                # Data processing
│   │   ├── snpedia-parser.service.ts
│   │   └── parsers.module.ts
│   └── raw-data-processing/    # 23andMe file processing
│       ├── raw-data-processing.service.ts
│       ├── raw-data-processing.controller.ts
│       └── raw-data-processing.module.ts
├── prisma/
│   └── schema.prisma          # Database schema
├── test/                      # Test files
└── package.json
```

## 🔬 Data Sources

Genome AI integrates multiple high-quality genomics databases:

- **SNPedia**: 100,000+ variant annotations (vs 23andMe's ~250)
- **ClinVar**: 2.3M clinical variants with expert curation
- **PharmGKB**: 700+ drug-gene interactions (vs 23andMe's 3)
- **PGS Catalog**: 3,000+ polygenic risk scores
- **GWAS Catalog**: Latest research findings

## 🧠 AI Features

### Evidence Synthesis
- Weight studies by sample size and quality
- Resolve contradictory findings intelligently
- Provide confidence scores and uncertainty measures

### Conflict Resolution
```typescript
// Example AI-powered evidence resolution
const resolution = await aiService.resolveConflictingEvidence([
  { effect: 1.5, sampleSize: 50000, quality: 'high' },
  { effect: 0.8, sampleSize: 10000, quality: 'moderate' }
]);
// Returns weighted interpretation with confidence scores
```

## 🔒 Privacy & Security

- **Local Processing**: All genetic data processed locally
- **No Cloud Storage**: Raw genetic data never leaves your system
- **Research vs Clinical**: Clear disclaimers about research use
- **Actionable Focus**: Emphasis on preventive insights, not fearmongering

## 🛣️ Roadmap

### Phase 1: Foundation ✅
- [x] NestJS application setup
- [x] SNPedia data extraction
- [x] Basic variant processing
- [x] Database schema implementation

### Phase 2: Core Analysis (In Progress)
- [ ] Pharmacogenomics analysis service
- [ ] Monogenic risk assessment
- [ ] Physical traits analysis
- [ ] AI interpretation integration

### Phase 3: Advanced Features
- [ ] Polygenic risk score calculations
- [ ] Population-specific analysis
- [ ] Real-time data processing
- [ ] Interactive web dashboard

## 📈 Performance Goals

- **Coverage**: Analyze 10x more actionable variants than 23andMe
- **Speed**: Sub-second API response times for variant lookups
- **Accuracy**: Consistency with clinical guidelines where available
- **Scalability**: Process multiple genomes efficiently

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⚖️ Legal Disclaimer

This tool is for research and educational purposes only. It is not intended for clinical diagnosis or medical decision-making. Always consult with healthcare professionals for medical advice.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SNPedia](https://snpedia.com) for comprehensive variant annotations
- [NestJS](https://nestjs.com) for the excellent framework
- [Vercel AI SDK](https://sdk.vercel.ai) for AI integration capabilities
- Modern genomics research community for evidence-based frameworks
