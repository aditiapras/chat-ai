import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Badge } from "~/components/ui/badge";

interface ReasoningDisplayProps {
  reasoning: string;
  isStreaming?: boolean;
  className?: string;
}

export function ReasoningDisplay({
  reasoning,
  isStreaming = false,
  className = "",
}: ReasoningDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoning && !isStreaming) {
    return null;
  }

  return (
    <div
      className={`border border-blue-200 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 ${className}`}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-3 h-auto hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Reasoning Process
              </span>
              {isStreaming && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                >
                  Streaming...
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          <div className="mt-2 p-3 bg-white/50 dark:bg-gray-900/50 rounded border border-blue-200/50 dark:border-blue-800/50">
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {reasoning || (isStreaming ? "Thinking..." : "")}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
