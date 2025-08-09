import React, { memo, useMemo } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date | string;
}

interface MessageComponentProps {
  message: Message;
  isLast?: boolean;
}

// Memoized message component to prevent unnecessary re-renders
export const MessageComponent = memo<MessageComponentProps>(
  ({ message, isLast = false }) => {
    // Memoize className computation to avoid recalculation on every render
    const containerClassName = useMemo(() => {
      const baseClasses = "flex flex-col items-center gap-2 w-full";
      return isLast ? `${baseClasses} mb-4` : baseClasses;
    }, [isLast]);

    const messageClassName = useMemo(() => {
      if (message.role === "user") {
        return "justify-end p-2 max-w-[70%] w-fit ml-auto rounded-xl rounded-br-none bg-accent flex";
      }
      return "justify-start w-full flex";
    }, [message.role]);

    // Memoize content rendering to avoid expensive markdown parsing on every render
    const renderedContent = useMemo(() => {
      if (message.role === "assistant") {
        return (
          <MarkdownRenderer
            content={message.content}
            className="w-full prose prose-sm dark:prose-invert max-w-none"
          />
        );
      }
      return message.content;
    }, [message.role, message.content]);

    return (
      <div className={containerClassName}>
        <div className={messageClassName}>{renderedContent}</div>
      </div>
    );
  }
);

MessageComponent.displayName = "MessageComponent";

// Virtualized message list for handling large conversations
interface VirtualizedMessageListProps {
  messages: Message[];
  height?: number;
  itemHeight?: number;
}

export const VirtualizedMessageList = memo<VirtualizedMessageListProps>(
  ({ messages, height = 400, itemHeight = 100 }) => {
    const [startIndex, setStartIndex] = React.useState(0);
    const [endIndex, setEndIndex] = React.useState(
      Math.ceil(height / itemHeight)
    );

    const containerRef = React.useRef<HTMLDivElement>(null);

    // Handle scroll for virtualization
    const handleScroll = React.useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        const newStartIndex = Math.floor(scrollTop / itemHeight);
        const visibleCount = Math.ceil(height / itemHeight);
        const newEndIndex = Math.min(
          newStartIndex + visibleCount + 2,
          messages.length
        );

        setStartIndex(newStartIndex);
        setEndIndex(newEndIndex);
      },
      [itemHeight, height, messages.length]
    );

    // Memoize visible messages to avoid unnecessary filtering
    const visibleMessages = useMemo(() => {
      return messages.slice(startIndex, endIndex);
    }, [messages, startIndex, endIndex]);

    // Calculate total height and offset
    const totalHeight = messages.length * itemHeight;
    const offsetY = startIndex * itemHeight;

    return (
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleMessages.map((message, index) => (
              <div key={message.id} style={{ height: itemHeight }}>
                <MessageComponent
                  message={message}
                  isLast={startIndex + index === messages.length - 1}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

VirtualizedMessageList.displayName = "VirtualizedMessageList";

// Optimized message input component
interface OptimizedMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const OptimizedMessageInput = memo<OptimizedMessageInputProps>(
  ({
    value,
    onChange,
    onSubmit,
    disabled = false,
    placeholder = "Type your message...",
  }) => {
    // Debounce input changes to reduce re-renders
    const [localValue, setLocalValue] = React.useState(value);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleInputChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Debounce the onChange call
        timeoutRef.current = setTimeout(() => {
          onChange(newValue);
        }, 150);
      },
      [onChange]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      },
      [onSubmit]
    );

    // Cleanup timeout on unmount
    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <textarea
        value={localValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="text-lg border-none shadow-none resize-none focus:ring-0 focus-visible:ring-0 w-full"
        rows={1}
        style={{ minHeight: "2.5rem", maxHeight: "10rem" }}
      />
    );
  }
);

OptimizedMessageInput.displayName = "OptimizedMessageInput";
