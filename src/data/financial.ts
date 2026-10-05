export type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

export const chatMessages: ChatMessage[] = [
  {
    role: "assistant",
    text: "재무제표를 업로드하면 성장성, 안정성, 수익성을 중심으로 먼저 요약해드릴게요.",
  },
  {
    role: "user",
    text: "이 기업의 전반적인 상태를 먼저 알려줘.",
  },
  {
    role: "assistant",
    text: "매출 성장 흐름은 양호하고, 부채 부담은 보통 수준이며, 수익성은 최근 분기 개선 흐름이 보입니다.",
  },
];
