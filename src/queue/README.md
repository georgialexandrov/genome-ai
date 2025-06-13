# Universal Task Queue System

This queue system provides a universal, scalable way to handle background tasks in the genome analysis application.

## Features

- **Universal**: Can handle any type of task, not just SNP processing
- **FIFO with Priority**: Tasks are processed in order of priority, then creation time
- **Retry Logic**: Failed tasks are automatically retried up to a configurable limit
- **Status Tracking**: Tasks have clear status states (pending, processing, done, error)
- **Cron Processing**: Automatic background processing every 5 seconds
- **Cleanup**: Automatic cleanup of old completed tasks
- **Single Worker**: Only one task processes at a time to avoid conflicts

## Database Schema

```prisma
model TaskQueue {
  id           Int      @id @default(autoincrement())
  taskType     String   // Type of task (e.g., "snpedia-update", "genome-analysis")
  taskId       String   // Unique identifier for the specific task
  arguments    Json?    // Task-specific arguments as JSON
  status       String   @default("pending") // pending, processing, done, error
  priority     Int      @default(0) // Higher number = higher priority
  retryCount   Int      @default(0)
  maxRetries   Int      @default(3)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  processedAt  DateTime?
  completedAt  DateTime?
  errorMessage String?
  result       Json?    // Task result stored as JSON
  
  @@unique([taskType, taskId]) // Ensure unique tasks
  @@index([status, priority, createdAt])
  @@index([taskType, status])
}
```

## Task Processors

To add a new task type, create a processor that implements the `TaskProcessor` interface:

```typescript
@Injectable()
export class MyTaskProcessor implements TaskProcessor {
  readonly taskType = 'my-task-type';
  
  async process(taskId: string, arguments?: any): Promise<any> {
    // Your task processing logic here
    return { success: true, result: 'processed' };
  }
}
```

Then register it in your module's `onModuleInit`:

```typescript
export class MyModule implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly myTaskProcessor: MyTaskProcessor,
  ) {}

  async onModuleInit() {
    this.queueService.registerProcessor(this.myTaskProcessor);
  }
}
```

## API Endpoints

### Queue Management
- `GET /queue/stats` - Get queue statistics
- `GET /queue/tasks/:taskType` - List tasks by type
- `POST /queue/cleanup` - Clean up old completed tasks
- `POST /queue/add-task/:taskType/:taskId` - Add a task to the queue

### SNPedia Discovery
- `POST /queue/discover-snps` - Start SNPedia discovery process
- `GET /queue/discovery-stats` - Get discovery statistics

## CLI Tool

Use the CLI tool to manage the queue:

```bash
# Show queue statistics
npm run queue:cli stats

# Start SNPedia discovery
npm run queue:cli discover

# Add a test task
npm run queue:cli add-test-task rs1234567

# List tasks by type
npm run queue:cli list-tasks snpedia-update

# Clean up old tasks
npm run queue:cli cleanup 14

# Show discovery statistics
npm run queue:cli discovery-stats
```

## SNPedia Integration

The system includes a specialized SNPedia discovery service that:

1. **Discovers SNPs**: Crawls SNPedia to find all available RS IDs
2. **Checks Database**: Only queues tasks for SNPs that exist in your database
3. **Queues Updates**: Adds tasks to fetch and interpret SNP data
4. **Batched Processing**: Processes discoveries in batches to avoid overwhelming the database

### SNPedia Task Flow

1. Discovery service crawls SNPedia category pages
2. Extracts RS IDs from page links
3. Checks which RS IDs exist in your database
4. Adds `snpedia-update` tasks for existing SNPs
5. Queue processor picks up tasks every 5 seconds
6. SNPedia task processor fetches and interprets SNP data
7. Results are stored in the database

## Configuration

The queue system runs with these default settings:

- **Processing Interval**: Every 5 seconds
- **Max Retries**: 3 attempts per task
- **Cleanup Schedule**: Daily at 2 AM
- **Cleanup Age**: 7 days for completed tasks
- **Single Worker**: Only one task processes at a time

## Monitoring

Monitor the queue health using:

```bash
# Quick stats
npm run queue:cli stats

# Detailed task listing
npm run queue:cli list-tasks snpedia-update

# Discovery progress
npm run queue:cli discovery-stats
```

The queue automatically logs processing status and errors for monitoring purposes.
