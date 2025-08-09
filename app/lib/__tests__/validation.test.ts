import { describe, it, expect } from "@jest/globals";
import {
  chatRequestSchema,
  threadRequestSchema,
  validateRequest,
  sanitizeInput,
  securityValidations,
} from "../validation";

describe("Input Validation", () => {
  describe("chatRequestSchema", () => {
    it("should validate valid chat request", () => {
      const validRequest = {
        messages: [
          { role: "user", content: "Hello world", id: "msg-1" },
          { role: "assistant", content: "Hi there!" },
        ],
        model: "openai/gpt-4o-mini",
        threadId: "123e4567-e89b-12d3-a456-426614174000",
        isPartial: false,
      };

      const result = chatRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject invalid message roles", () => {
      const invalidRequest = {
        messages: [{ role: "invalid", content: "Hello world" }],
        model: "openai/gpt-4o-mini",
        threadId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = chatRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject oversized content", () => {
      const oversizedContent = "a".repeat(10001);
      const invalidRequest = {
        messages: [{ role: "user", content: oversizedContent }],
        model: "openai/gpt-4o-mini",
        threadId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = chatRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject invalid UUID format", () => {
      const invalidRequest = {
        messages: [{ role: "user", content: "Hello world" }],
        model: "openai/gpt-4o-mini",
        threadId: "invalid-uuid",
      };

      const result = chatRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject too many messages", () => {
      const tooManyMessages = Array.from({ length: 101 }, (_, i) => ({
        role: "user" as const,
        content: `Message ${i}`,
      }));

      const invalidRequest = {
        messages: tooManyMessages,
        model: "openai/gpt-4o-mini",
        threadId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = chatRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject invalid model format", () => {
      const invalidRequest = {
        messages: [{ role: "user", content: "Hello world" }],
        model: "invalid@model!",
        threadId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = chatRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe("threadRequestSchema", () => {
    it("should validate valid thread request", () => {
      const validRequest = {
        prompt: "Create a new chat thread",
        model: "openai/gpt-4o-mini",
      };

      const result = threadRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject empty prompt", () => {
      const invalidRequest = {
        prompt: "",
        model: "openai/gpt-4o-mini",
      };

      const result = threadRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject oversized prompt", () => {
      const oversizedPrompt = "a".repeat(1001);
      const invalidRequest = {
        prompt: oversizedPrompt,
        model: "openai/gpt-4o-mini",
      };

      const result = threadRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should trim whitespace from prompt", () => {
      const requestWithWhitespace = {
        prompt: "  Hello world  ",
        model: "openai/gpt-4o-mini",
      };

      const result = threadRequestSchema.safeParse(requestWithWhitespace);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt).toBe("Hello world");
      }
    });
  });

  describe("validateRequest helper", () => {
    it("should return success for valid data", () => {
      const validData = {
        prompt: "Hello world",
        model: "openai/gpt-4o-mini",
      };

      const result = threadRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("should return error for invalid data", () => {
      const invalidData = {
        prompt: "",
        model: "invalid@model!",
      };

      const result = validateRequest(threadRequestSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Validation failed");
      }
    });
  });
});

describe("Input Sanitization", () => {
  describe("sanitizeInput", () => {
    it("should remove script tags", () => {
      const maliciousInput = '<script>alert("xss")</script>Hello world';
      const sanitized = sanitizeInput(maliciousInput);
      expect(sanitized).toBe("Hello world");
    });

    it("should remove javascript: URLs", () => {
      const maliciousInput = 'Click here: javascript:alert("xss")';
      const sanitized = sanitizeInput(maliciousInput);
      expect(sanitized).toBe("Click here:");
    });

    it("should remove event handlers", () => {
      const maliciousInput = "<div onclick=\"alert('xss')\">Hello</div>";
      const sanitized = sanitizeInput(maliciousInput);
      expect(sanitized).toBe("<div>Hello</div>");
    });

    it("should trim whitespace", () => {
      const input = "  Hello world  ";
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe("Hello world");
    });

    it("should handle empty input", () => {
      const sanitized = sanitizeInput("");
      expect(sanitized).toBe("");
    });

    it("should handle complex XSS attempts", () => {
      const maliciousInput = `
        <script>alert('xss')</script>
        <img src="x" onerror="alert('xss')">
        javascript:alert('xss')
        Hello world
      `;
      const sanitized = sanitizeInput(maliciousInput);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("onerror");
      expect(sanitized).not.toContain("javascript:");
      expect(sanitized).toContain("Hello world");
    });
  });
});

describe("Security Validations", () => {
  describe("containsXSS", () => {
    it("should detect script tags", () => {
      expect(
        securityValidations.containsXSS('<script>alert("xss")</script>')
      ).toBe(true);
      expect(securityValidations.containsXSS("Hello world")).toBe(false);
    });

    it("should detect javascript: URLs", () => {
      expect(securityValidations.containsXSS('javascript:alert("xss")')).toBe(
        true
      );
      expect(securityValidations.containsXSS("https://example.com")).toBe(
        false
      );
    });

    it("should detect event handlers", () => {
      expect(securityValidations.containsXSS("onclick=\"alert('xss')\"")).toBe(
        true
      );
      expect(securityValidations.containsXSS('onload="malicious()"')).toBe(
        true
      );
      expect(securityValidations.containsXSS('class="safe"')).toBe(false);
    });

    it("should detect iframe tags", () => {
      expect(
        securityValidations.containsXSS(
          '<iframe src="malicious.html"></iframe>'
        )
      ).toBe(true);
      expect(securityValidations.containsXSS("<div>safe content</div>")).toBe(
        false
      );
    });
  });

  describe("containsSQLInjection", () => {
    it("should detect SQL keywords", () => {
      expect(
        securityValidations.containsSQLInjection("SELECT * FROM users")
      ).toBe(true);
      expect(securityValidations.containsSQLInjection("DROP TABLE users")).toBe(
        true
      );
      expect(securityValidations.containsSQLInjection("Hello world")).toBe(
        false
      );
    });

    it("should detect SQL injection patterns", () => {
      expect(
        securityValidations.containsSQLInjection("'; DROP TABLE users; --")
      ).toBe(true);
      expect(securityValidations.containsSQLInjection("1' OR '1'='1")).toBe(
        true
      );
      expect(securityValidations.containsSQLInjection("normal text")).toBe(
        false
      );
    });
  });

  describe("isValidUUID", () => {
    it("should validate correct UUIDs", () => {
      expect(
        securityValidations.isValidUUID("123e4567-e89b-12d3-a456-426614174000")
      ).toBe(true);
      expect(
        securityValidations.isValidUUID("550e8400-e29b-41d4-a716-446655440000")
      ).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(securityValidations.isValidUUID("invalid-uuid")).toBe(false);
      expect(securityValidations.isValidUUID("123e4567-e89b-12d3-a456")).toBe(
        false
      );
      expect(securityValidations.isValidUUID("")).toBe(false);
      expect(
        securityValidations.isValidUUID("123e4567-e89b-12d3-a456-42661417400g")
      ).toBe(false);
    });
  });
});

describe("Edge Cases and Security", () => {
  it("should handle null and undefined inputs safely", () => {
    expect(() => sanitizeInput(null as any)).not.toThrow();
    expect(() => sanitizeInput(undefined as any)).not.toThrow();
  });

  it("should handle very long inputs without performance issues", () => {
    const longInput = "a".repeat(100000);
    const start = Date.now();
    sanitizeInput(longInput);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it("should handle unicode and special characters", () => {
    const unicodeInput = '🚀 Hello 世界 <script>alert("xss")</script>';
    const sanitized = sanitizeInput(unicodeInput);
    expect(sanitized).toContain("🚀 Hello 世界");
    expect(sanitized).not.toContain("<script>");
  });
});
