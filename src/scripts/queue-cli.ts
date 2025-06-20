import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QueueService } from '../queue/queue.service';
import { SnpediaDiscoveryService } from '../crawlers/snpedia-discovery-api.service';
import { RawDataProcessingService } from '../raw-data-processing/raw-data-processing.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queueService = app.get(QueueService);
  const discoveryService = app.get(SnpediaDiscoveryService);
  const rawDataService = app.get(RawDataProcessingService);

  const command = process.argv[2];

  try {
    switch (command) {
      case 'stats':
        const stats = await queueService.getQueueStats();
        console.log('Queue Statistics:', JSON.stringify(stats, null, 2));
        break;

      case 'discover':
        console.log('Starting SNPedia discovery process...');
        const result = await discoveryService.discoverAndQueueSnpUpdates();
        console.log('Discovery Results:', JSON.stringify(result, null, 2));
        break;

      case 'add-test-task':
        const rsid = process.argv[3] || 'rs12345';
        await queueService.addTask('snpedia-update', rsid, { test: true });
        console.log(`Added test task for ${rsid}`);
        break;

      case 'list-tasks':
        const taskType = process.argv[3] || 'snpedia-update';
        const tasks = await queueService.getTasksByType(taskType);
        console.log(`Tasks for ${taskType}:`, JSON.stringify(tasks, null, 2));
        break;

      case 'cleanup':
        const days = parseInt(process.argv[3]) || 7;
        const cleaned = await queueService.cleanupOldTasks(days);
        console.log(`Cleaned up ${cleaned} old tasks`);
        break;

      case 'discovery-stats':
        const discoveryStats = await discoveryService.getDiscoveryStats();
        console.log(
          'Discovery Statistics:',
          JSON.stringify(discoveryStats, null, 2),
        );
        break;

      case 'test-api':
        console.log('Testing SNPedia API...');
        const apiTest = await discoveryService.testSnpediaApi();
        console.log('API Test Results:', JSON.stringify(apiTest, null, 2));
        break;

      case 'sync-dantelabs':
        console.log('Syncing DanteLabs data to Snp table...');
        await rawDataService.syncDanteLabsToSnpTable();
        console.log('DanteLabs data sync completed successfully');
        break;

      case 'sync-23andme':
        console.log('Syncing 23andMe data to Snp table...');
        await rawDataService.sync23andMeToSnpTable();
        console.log('23andMe data sync completed successfully');
        break;

      case 'process-23andme':
        const file23andme = process.argv[3];
        if (!file23andme) {
          console.error('Error: File path is required');
          console.log('Usage: npm run queue:cli process-23andme <filepath>');
          break;
        }
        console.log(`Processing 23andMe file: ${file23andme}`);
        await rawDataService.processReport(file23andme, 'TWENTYTHREEANDME');
        console.log('23andMe file processing completed successfully');
        break;

      case 'process-dantelabs':
        const fileDante = process.argv[3];
        if (!fileDante) {
          console.error('Error: File path is required');
          console.log('Usage: npm run queue:cli process-dantelabs <filepath>');
          break;
        }
        console.log(`Processing DanteLabs file: ${fileDante}`);
        await rawDataService.processReport(fileDante, 'DANTELABS');
        console.log('DanteLabs file processing completed successfully');
        break;

      default:
        console.log(`
Usage: npm run queue:cli <command> [args]

Commands:
  stats                    Show queue statistics
  test-api                 Test SNPedia API connection
  discover                 Start SNPedia discovery and queue SNP updates
  add-test-task [rsid]     Add a test task to the queue
  list-tasks [taskType]    List tasks by type
  cleanup [days]           Clean up old tasks (default: 7 days)
  discovery-stats          Show discovery statistics
  sync-dantelabs           Sync DanteLabs genotype data to Snp table
  sync-23andme             Sync 23andMe genotype data to Snp table
  process-23andme <file>   Process 23andMe raw data file
  process-dantelabs <file> Process DanteLabs raw data file

Examples:
  npm run queue:cli stats
  npm run queue:cli test-api
  npm run queue:cli discover
  npm run queue:cli add-test-task rs1234567
  npm run queue:cli list-tasks snpedia-update
  npm run queue:cli cleanup 14
  npm run queue:cli sync-dantelabs
  npm run queue:cli sync-23andme
  npm run queue:cli process-23andme ../genome_Georgi_Alexandrov_v5_Full_20250610040555.txt
  npm run queue:cli process-dantelabs ../genome_dantelabs.txt
        `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch(console.error);
