import {
  Controller,
  Get,
  Post,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
  Param,
  Delete,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { SnpediaDiscoveryService } from '../crawlers/snpedia-discovery-api.service';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly snpediaDiscoveryService: SnpediaDiscoveryService,
  ) {}

  @Get('test-snpedia-api')
  @HttpCode(HttpStatus.OK)
  async testSnpediaApi() {
    try {
      this.logger.log('Testing SNPedia API endpoint');
      const result = await this.snpediaDiscoveryService.testSnpediaApi();

      return {
        message: result.success
          ? 'SNPedia API test successful'
          : 'SNPedia API test failed',
        data: result,
      };
    } catch (error) {
      this.logger.error('Error testing SNPedia API:', error);
      return {
        message: `Error testing SNPedia API: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getQueueStats() {
    try {
      const stats = await this.queueService.getQueueStats();
      return {
        message: 'Queue statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error getting queue stats:', error);
      return {
        message: `Error getting queue stats: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('tasks/:taskType')
  @HttpCode(HttpStatus.OK)
  async getTasksByType(
    @Param('taskType') taskType: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const tasks = await this.queueService.getTasksByType(
        taskType,
        status,
        limit ? parseInt(limit) : 50,
        offset ? parseInt(offset) : 0,
      );

      return {
        message: `Tasks for type ${taskType} retrieved successfully`,
        data: {
          tasks,
          count: tasks.length,
          filters: { taskType, status, limit, offset },
        },
      };
    } catch (error) {
      this.logger.error(`Error getting tasks for type ${taskType}:`, error);
      return {
        message: `Error getting tasks for type ${taskType}: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupOldTasks(@Query('days') days?: string) {
    try {
      const daysOld = days ? parseInt(days) : 7;
      const cleanedCount = await this.queueService.cleanupOldTasks(daysOld);

      return {
        message: `Cleaned up ${cleanedCount} old tasks`,
        data: { cleanedCount, daysOld },
      };
    } catch (error) {
      this.logger.error('Error cleaning up old tasks:', error);
      return {
        message: `Error cleaning up old tasks: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Post('discover-snps')
  @HttpCode(HttpStatus.ACCEPTED)
  async discoverAndQueueSnps() {
    try {
      this.logger.log('Starting SNPedia discovery process');

      // Run discovery in background
      this.snpediaDiscoveryService
        .discoverAndQueueSnpUpdates()
        .then((result) => {
          this.logger.log(`Discovery completed: ${JSON.stringify(result)}`);
        })
        .catch((error) => {
          this.logger.error('Discovery process failed:', error);
        });

      return {
        message: 'SNPedia discovery process started. Check logs for progress.',
        data: { status: 'initiated' },
      };
    } catch (error) {
      this.logger.error('Error starting discovery process:', error);
      return {
        message: `Error starting discovery process: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Get('discovery-stats')
  @HttpCode(HttpStatus.OK)
  async getDiscoveryStats() {
    try {
      const stats = await this.snpediaDiscoveryService.getDiscoveryStats();
      return {
        message: 'Discovery statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error getting discovery stats:', error);
      return {
        message: `Error getting discovery stats: ${error.message}`,
        error: error.message,
      };
    }
  }

  @Post('add-task/:taskType/:taskId')
  @HttpCode(HttpStatus.CREATED)
  async addTask(
    @Param('taskType') taskType: string,
    @Param('taskId') taskId: string,
    @Query('priority') priority?: string,
    @Query('maxRetries') maxRetries?: string,
  ) {
    try {
      await this.queueService.addTask(
        taskType,
        taskId,
        null,
        priority ? parseInt(priority) : 0,
        maxRetries ? parseInt(maxRetries) : 3,
      );

      return {
        message: `Task ${taskType}:${taskId} added to queue successfully`,
        data: { taskType, taskId },
      };
    } catch (error) {
      this.logger.error(`Error adding task ${taskType}:${taskId}:`, error);
      return {
        message: `Error adding task ${taskType}:${taskId}: ${error.message}`,
        error: error.message,
      };
    }
  }
}
