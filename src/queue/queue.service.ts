import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface TaskProcessor {
  taskType: string;
  process(taskId: string, args?: any): Promise<any>;
}

export interface QueueTask {
  id: number;
  taskType: string;
  taskId: string;
  arguments?: any;
  status: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly processors = new Map<string, TaskProcessor>();
  private isProcessing = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a task processor for a specific task type
   */
  registerProcessor(processor: TaskProcessor) {
    this.processors.set(processor.taskType, processor);
    this.logger.log(
      `Registered processor for task type: ${processor.taskType}`,
    );
  }

  /**
   * Add a task to the queue
   */
  async addTask(
    taskType: string,
    taskId: string,
    args?: any,
    priority: number = 0,
    maxRetries: number = 3,
  ): Promise<void> {
    try {
      await this.prisma.taskQueue.upsert({
        where: {
          taskType_taskId: {
            taskType,
            taskId,
          },
        },
        update: {
          arguments: args,
          priority,
          maxRetries,
          status: 'pending',
          retryCount: 0,
          errorMessage: null,
          result: undefined,
        },
        create: {
          taskType,
          taskId,
          arguments: args,
          priority,
          maxRetries,
          status: 'pending',
        },
      });

      this.logger.log(`Added task to queue: ${taskType}:${taskId}`);
    } catch (error) {
      this.logger.error(
        `Error adding task to queue: ${taskType}:${taskId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get the next pending task (FIFO with priority)
   */
  async getNextTask(): Promise<QueueTask | null> {
    const task = await this.prisma.taskQueue.findFirst({
      where: {
        status: 'pending',
      },
      orderBy: [
        { priority: 'desc' }, // Higher priority first
        { createdAt: 'asc' }, // Then FIFO
      ],
    });

    return task;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    id: number,
    status: string,
    errorMessage?: string,
    result?: any,
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.processedAt = new Date();
    } else if (status === 'done') {
      updateData.completedAt = new Date();
      if (result !== undefined) {
        updateData.result = result;
      }
    } else if (status === 'error') {
      updateData.errorMessage = errorMessage;
    }

    await this.prisma.taskQueue.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Increment retry count for a task
   */
  async incrementRetryCount(id: number): Promise<boolean> {
    const task = await this.prisma.taskQueue.findUnique({
      where: { id },
    });

    if (!task) {
      return false;
    }

    const newRetryCount = task.retryCount + 1;
    const shouldRetry = newRetryCount <= task.maxRetries;

    await this.prisma.taskQueue.update({
      where: { id },
      data: {
        retryCount: newRetryCount,
        status: shouldRetry ? 'pending' : 'error',
        errorMessage: shouldRetry
          ? null
          : `Max retries (${task.maxRetries}) exceeded`,
      },
    });

    return shouldRetry;
  }

  /**
   * Process a single task
   */
  async processTask(task: QueueTask): Promise<void> {
    const processor = this.processors.get(task.taskType);
    if (!processor) {
      this.logger.error(`No processor found for task type: ${task.taskType}`);
      await this.updateTaskStatus(
        task.id,
        'error',
        `No processor registered for task type: ${task.taskType}`,
      );
      return;
    }

    try {
      this.logger.log(`Processing task: ${task.taskType}:${task.taskId}`);
      await this.updateTaskStatus(task.id, 'processing');

      const result = await processor.process(task.taskId, task.arguments);

      await this.updateTaskStatus(task.id, 'done', undefined, result);
      this.logger.log(`Completed task: ${task.taskType}:${task.taskId}`);
    } catch (error) {
      this.logger.error(
        `Error processing task: ${task.taskType}:${task.taskId}`,
        error,
      );

      const shouldRetry = await this.incrementRetryCount(task.id);
      if (!shouldRetry) {
        await this.updateTaskStatus(
          task.id,
          'error',
          error.message || 'Unknown error',
        );
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    done: number;
    error: number;
    total: number;
  }> {
    const [pending, processing, done, error, total] = await Promise.all([
      this.prisma.taskQueue.count({ where: { status: 'pending' } }),
      this.prisma.taskQueue.count({ where: { status: 'processing' } }),
      this.prisma.taskQueue.count({ where: { status: 'done' } }),
      this.prisma.taskQueue.count({ where: { status: 'error' } }),
      this.prisma.taskQueue.count(),
    ]);

    return { pending, processing, done, error, total };
  }

  /**
   * Get tasks by type and status
   */
  async getTasksByType(
    taskType: string,
    status?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<QueueTask[]> {
    const where: any = { taskType };
    if (status) {
      where.status = status;
    }

    return this.prisma.taskQueue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Clear completed tasks older than specified days
   */
  async cleanupOldTasks(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.taskQueue.deleteMany({
      where: {
        status: {
          in: ['done', 'error'],
        },
        completedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old tasks`);
    return result.count;
  }

  /**
   * Cron job to process queue every 5 seconds
   */
  @Cron('*/5 * * * * *') // Every 5 seconds
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Queue processor already running, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const task = await this.getNextTask();
      if (task) {
        await this.processTask(task);
      }
    } catch (error) {
      this.logger.error('Error in queue processor:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cron job to cleanup old tasks daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyCleanup(): Promise<void> {
    this.logger.log('Running daily task cleanup');
    await this.cleanupOldTasks(7);
  }
}
