import { Send, MessageSquare } from "lucide-react";
import Button from "@/components/common/Button";
import { TextInput } from "@/components/common/Form";
import Box from "./Box";
import { chatMessages } from "@/data/financial";

type ChatPanelProps = {
  compact?: boolean;
};

export default function ChatPanel({ compact = false }: ChatPanelProps) {
  return (
    <Box
      className={`flex flex-col border-blue-100 bg-gradient-to-b from-white to-sky-50/70 p-4 ${
        compact
          ? "max-h-[calc(100vh-15rem)] min-h-[300px]"
          : "max-h-[calc(100vh-8rem)] min-h-[420px] xl:sticky xl:top-24"
      }`}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-sky-100 pb-3">
        <span className="rounded-lg bg-sky-100 p-2 text-blue-700">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div className="text-sm font-semibold text-blue-950">챗봇 대화</div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[90%] rounded-lg px-4 py-3 text-sm leading-6 ${
              msg.role === "assistant"
                ? "bg-sky-100/80 text-slate-700"
                : "ml-auto bg-blue-950 text-white shadow-sm shadow-blue-950/10"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-sky-100 pt-3">
        <TextInput
          placeholder="챗봇과 대화"
          className="flex-1"
        />
        <Button size="icon" aria-label="챗봇 메시지 보내기">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Box>
  );
}
