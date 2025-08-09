import { prisma } from "./prisma";
import { SecureLogger } from "./logger";

export class OptimizedQueries {
  // Paginated message loading with performance optimizations
  static async getThreadMessages(
    threadId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ) {
    const offset = (page - 1) * limit;

    try {
      // Single optimized query with ownership validation
      const [messages, totalCount] = await Promise.all([
        prisma.message.findMany({
          where: {
            threadId,
            Thread: {
              userId: userId, // Ensure ownership
            },
          },
          orderBy: { createdAt: "asc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            content: true,
            role: true,
            model: true,
            createdAt: true,
          },
        }),
        prisma.message.count({
          where: {
            threadId,
            Thread: {
              userId: userId,
            },
          },
        }),
      ]);

      return {
        messages,
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: offset + messages.length < totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      SecureLogger.error("Error fetching paginated messages", error as Error, {
        threadId,
        userId: userId.substring(0, 8) + "...",
        page,
        limit,
      });
      throw error;
    }
  }

  // Optimized thread with ownership check and limited messages
  static async getThreadWithAuth(
    threadId: string,
    userId: string,
    messageLimit: number = 50
  ) {
    try {
      const thread = await prisma.thread.findFirst({
        where: {
          id: threadId,
          userId: userId, // Ownership validation built-in
        },
        include: {
          Message: {
            orderBy: { createdAt: "asc" },
            take: messageLimit,
            select: {
              id: true,
              content: true,
              role: true,
              model: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              Message: true, // Get total message count
            },
          },
        },
      });

      if (!thread) {
        return null;
      }

      return {
        ...thread,
        hasMoreMessages: thread._count.Message > messageLimit,
        totalMessages: thread._count.Message,
      };
    } catch (error) {
      SecureLogger.error("Error fetching thread with auth", error as Error, {
        threadId,
        userId: userId.substring(0, 8) + "...",
      });
      throw error;
    }
  }

  // Prevent duplicate messages with improved deduplication
  static async createMessageSafely(data: {
    threadId: string;
    role: string;
    content: string;
    model: string;
    userId: string;
  }) {
    const { userId, ...messageData } = data;

    try {
      // Verify thread ownership before creating message
      const thread = await prisma.thread.findFirst({
        where: {
          id: data.threadId,
          userId: userId,
        },
        select: { id: true },
      });

      if (!thread) {
        throw new Error("Thread not found or access denied");
      }

      // Check for recent duplicate messages (within last 2 seconds)
      const recentMessage = await prisma.message.findFirst({
        where: {
          threadId: data.threadId,
          role: data.role,
          content: data.content,
          createdAt: {
            gte: new Date(Date.now() - 2000), // Within last 2 seconds
          },
        },
        select: { id: true, content: true, role: true, createdAt: true },
      });

      if (recentMessage) {
        SecureLogger.warn("Duplicate message detected, returning existing", {
          threadId: data.threadId,
          messageId: recentMessage.id,
        });
        return recentMessage;
      }

      return await prisma.message.create({ data: messageData });
    } catch (error) {
      SecureLogger.error("Error creating message safely", error as Error, {
        threadId: data.threadId,
        userId: userId.substring(0, 8) + "...",
        role: data.role,
      });
      throw error;
    }
  }

  // Optimized thread list with pagination
  static async getUserThreads(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const offset = (page - 1) * limit;

    try {
      const [threads, totalCount] = await Promise.all([
        prisma.thread.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            title: true,
            model: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                Message: true,
              },
            },
            Message: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                content: true,
                role: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.thread.count({ where: { userId } }),
      ]);

      return {
        threads: threads.map((thread) => ({
          ...thread,
          lastMessage: thread.Message[0] || null,
          messageCount: thread._count.Message,
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: offset + threads.length < totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      SecureLogger.error("Error fetching user threads", error as Error, {
        userId: userId.substring(0, 8) + "...",
        page,
        limit,
      });
      throw error;
    }
  }

  // Bulk operations for better performance
  static async bulkCreateMessages(
    messages: Array<{
      threadId: string;
      role: string;
      content: string;
      model: string;
    }>,
    userId: string
  ) {
    try {
      // Verify all threads belong to user
      const threadIds = [...new Set(messages.map((m) => m.threadId))];
      const userThreads = await prisma.thread.findMany({
        where: {
          id: { in: threadIds },
          userId: userId,
        },
        select: { id: true },
      });

      const validThreadIds = new Set(userThreads.map((t) => t.id));
      const validMessages = messages.filter((m) =>
        validThreadIds.has(m.threadId)
      );

      if (validMessages.length === 0) {
        throw new Error("No valid threads found for bulk message creation");
      }

      return await prisma.message.createMany({
        data: validMessages,
        skipDuplicates: true,
      });
    } catch (error) {
      SecureLogger.error("Error bulk creating messages", error as Error, {
        userId: userId.substring(0, 8) + "...",
        messageCount: messages.length,
      });
      throw error;
    }
  }

  // Database health check and optimization
  static async performHealthCheck() {
    try {
      const start = Date.now();

      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`;

      const connectionTime = Date.now() - start;

      // Get database stats
      const stats = await Promise.all([
        prisma.thread.count(),
        prisma.message.count(),
        prisma.aIModel.count(),
      ]);

      const [threadCount, messageCount, modelCount] = stats;

      SecureLogger.info("Database health check completed", {
        connectionTime: `${connectionTime}ms`,
        threadCount,
        messageCount,
        modelCount,
        status: connectionTime < 100 ? "healthy" : "slow",
      });

      return {
        healthy: connectionTime < 1000,
        connectionTime,
        stats: {
          threads: threadCount,
          messages: messageCount,
          models: modelCount,
        },
      };
    } catch (error) {
      SecureLogger.error("Database health check failed", error as Error);
      return {
        healthy: false,
        error: (error as Error).message,
      };
    }
  }
}

// Connection pool optimization
export class DatabaseOptimizer {
  static async optimizeConnections() {
    try {
      // Warm up the connection pool
      await prisma.$connect();

      SecureLogger.info("Database connection pool optimized");
    } catch (error) {
      SecureLogger.error(
        "Failed to optimize database connections",
        error as Error
      );
    }
  }

  static async cleanup() {
    try {
      await prisma.$disconnect();
      SecureLogger.info("Database connections cleaned up");
    } catch (error) {
      SecureLogger.error(
        "Failed to cleanup database connections",
        error as Error
      );
    }
  }
}
