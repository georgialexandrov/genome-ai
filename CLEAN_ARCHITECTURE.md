# 🧬 Queue System - Clean Architecture

## 📁 **Current File Structure** (After Cleanup)

```
src/
├── queue/                          # 🚀 Universal Queue System
│   ├── queue.service.ts           # Core queue management & cron processing
│   ├── queue.controller.ts        # RESTful API endpoints
│   ├── queue.module.ts            # Module configuration
│   └── README.md                  # Documentation
│
├── crawlers/                      # 🔍 SNPedia Integration  
│   ├── snpedia-discovery-api.service.ts  # SNPedia API discovery
│   ├── snpedia-task.processor.ts         # SNP task processor
│   ├── snpedia.service.ts               # SNP data fetching & interpretation
│   ├── snpedia.controller.ts            # SNP endpoints
│   └── crawlers.module.ts               # Module configuration
│
├── scripts/                       # 🛠️ CLI Tools
│   └── queue-cli.ts              # Command-line management
│
├── prisma/                        # 🗄️ Database
│   └── prisma.service.ts         # Database connection
│
└── [other modules...]            # 📦 Existing modules
```

## 🗑️ **Removed Files** (Old/Redundant)

- ❌ `src/crawlers/snpedia-discovery.service.ts` (old web scraping approach)
- ❌ `src/crawlers/queue.service.ts` (old SNP-specific queue)
- ❌ `test-*.js` files (temporary development files)

## ✅ **Key Architecture Benefits**

### **1. Clean Separation of Concerns**
- **Queue System**: Universal task processing in `src/queue/`
- **SNP Integration**: Specific SNPedia logic in `src/crawlers/`
- **CLI Tools**: Management utilities in `src/scripts/`

### **2. Modern API-Based Approach**
- Uses official SNPedia API (`https://bots.snpedia.com/api.php`)
- Handles both "rs" and "I" identifiers
- Proper error handling and rate limiting

### **3. Universal Queue Design**
- Can handle any task type, not just SNP processing
- JSON arguments for flexible task configuration
- Built-in retry logic and status tracking

## 🎯 **Ready for Production**

The cleaned-up system provides:
- ✅ Reliable SNPedia API integration
- ✅ Universal task queue for future expansion
- ✅ Complete monitoring and management tools
- ✅ Clean, maintainable architecture

**Next Step**: Run the database migration and start processing your SNPs!

```bash
npx prisma migrate dev --name "add-universal-task-queue"
npm run queue:cli discover
```
