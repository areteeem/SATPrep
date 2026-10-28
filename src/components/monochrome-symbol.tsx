import {
  Award,
  BookOpen,
  Brain,
  CircleHelp,
  Clock3,
  FileText,
  Lightbulb,
  Link,
  MessageSquare,
  Pencil,
  Puzzle,
  Save,
  Search,
  Share2,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
const symbols: Record<string, LucideIcon> = {
  "🎉": Trophy,
  "👏": Award,
  "💪": Target,
  "💾": Save,
  "🤔": CircleHelp,
  "🧠": Brain,
  "❓": CircleHelp,
  "🧩": Puzzle,
  "✏️": Pencil,
  "📝": FileText,
  "💬": MessageSquare,
  "📚": BookOpen,
  "📖": BookOpen,
  "💡": Lightbulb,
  "✨": Sparkles,
  "🎯": Target,
  "⏳": Clock3,
  "🔍": Search,
  share: Share2,
  link: Link,
  note: FileText,
};
export function MonochromeSymbol({
  symbol,
  size = 24,
  className = "",
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const Icon = symbols[symbol] || Sparkles;
  return (
    <Icon
      aria-hidden="true"
      size={size}
      strokeWidth={1.6}
      className={`inline-block shrink-0 align-middle ${className}`}
    />
  );
}
