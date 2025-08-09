import { RateLimiterMemory } from "rate-limiter-flexible";

const rateLimiters = {
  chat: new RateLimiterMemory({
    keyPrefix: "chat_api",
    points: 30, // 30 requests
    duration: 60, // per 60 seconds
  }),
  thread: new RateLimiterMemory({
    keyPrefix: "thread_api",
    points: 10, // 10 thread creations
    duration: 60, // per 60 seconds
  }),
  general: new RateLimiterMemory({
    keyPrefix: "general_api",
    points: 100, // 100 requests
    duration: 60, // per 60 seconds
  }),
};

export async function checkRateLimit(
  type: keyof typeof rateLimiters,
  identifier: string
): Promise<{ allowed: boolean; resetTime?: Date; remainingPoints?: number }> {
  try {
    const resRateLimiter = await rateLimiters[type].consume(identifier);
    return {
      allowed: true,
      remainingPoints: resRateLimiter.remainingPoints,
    };
  } catch (rejRes: any) {
    return {
      allowed: false,
      resetTime: new Date(Date.now() + rejRes.msBeforeNext),
      remainingPoints: rejRes.remainingPoints || 0,
    };
  }
}

export function createRateLimitResponse(resetTime: Date): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      resetTime: resetTime.toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": Math.ceil(
          (resetTime.getTime() - Date.now()) / 1000
        ).toString(),
        "X-RateLimit-Reset": resetTime.toISOString(),
      },
    }
  );
}

// Middleware helper for rate limiting
export async function withRateLimit(
  type: keyof typeof rateLimiters,
  identifier: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const rateCheck = await checkRateLimit(type, identifier);

  if (!rateCheck.allowed) {
    return createRateLimitResponse(rateCheck.resetTime!);
  }

  const response = await handler();

  // Add rate limit headers to successful responses
  response.headers.set(
    "X-RateLimit-Remaining",
    rateCheck.remainingPoints?.toString() || "0"
  );

  return response;
}
