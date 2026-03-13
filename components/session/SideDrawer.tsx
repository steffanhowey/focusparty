"use client";

import { useEffect, memo } from "react";
import type { ChatMessage } from "@/lib/useChat";
import { PanelHeader } from "./PanelHeader";
import { ChatContent } from "./ChatFlyout";

interface SideDrawerProps {
  onClose: () => void;
  panel: "chat";
  // Chat
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const SideDrawer = memo(function SideDrawer({
  onClose,
  panel,
  messages,
  onSendMessage,
}: SideDrawerProps) {

  // Escape key closes drawer
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <PanelHeader
        title="Chat"
        onClose={onClose}
      />

      {panel === "chat" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatContent messages={messages} onSendMessage={onSendMessage} />
        </div>
      )}
    </>
  );
});
