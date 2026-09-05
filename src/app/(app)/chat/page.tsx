import type { Metadata } from "next";

import { NewChat } from "@/features/chat/components";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <NewChat />;
}
