import { z } from "zod";

// Chat API validation schemas
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(50000), // More permissive content limit
        id: z.string().optional(),
      })
    )
    .min(1)
    .max(1000), // More permissive message limit
  model: z.string().min(1), // More permissive model validation
  threadId: z.string().min(1), // More permissive UUID validation
  isPartial: z.boolean().optional(),
  partialContent: z.string().max(50000).optional(),
});

// Thread creation validation
export const threadRequestSchema = z.object({
  prompt: z.string().min(1).max(5000).trim(), // More permissive prompt limit
  model: z.string().min(1), // More permissive model validation
});

// Sanitization utilities
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove scripts
    .replace(/javascript:/gi, "") // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
};

// Validation helper function
export const validateRequest = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } => {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return { success: false, error: `Validation failed: ${errorMessage}` };
    }
    return { success: false, error: "Invalid request format" };
  }
};

// Additional security validations
export const securityValidations = {
  // Check for potential XSS patterns
  containsXSS: (input: string): boolean => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
    ];
    return xssPatterns.some((pattern) => pattern.test(input));
  },

  // Check for SQL injection patterns
  containsSQLInjection: (input: string): boolean => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /('|(\\')|(;)|(--)|(\|)|(\*)|(%)|(\+))/gi,
    ];
    return sqlPatterns.some((pattern) => pattern.test(input));
  },

  // Validate UUID format
  isValidUUID: (uuid: string): boolean => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
};
