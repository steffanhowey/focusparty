"use client";

import { useEffect, memo } from "react";
import type { Task } from "@/lib/types";
import type { ChatMessage } from "@/lib/useChat";
import { PanelHeader } from "./PanelHeader";
import { TasksPanel } from "./TasksPanel";
import { ChatContent } from "./ChatFlyout";

interface SideDrawerProps {
  onClose: () => void;
  panel: "tasks" | "chat";
  // Tasks
  activeTasks: Task[];
  completedTasks: Task[];
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, newText: string) => void;
  onReorderTasks: (activeId: string, overId: string) => void;
  // Chat
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const SideDrawer = memo(function SideDrawer({
  onClose,
  panel,
  activeTasks,
  completedTasks,
  onCompleteTask,
  onUncompleteTask,
  onAddTask,
  onDeleteTask,
  onEditTask,
  onReorderTasks,
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
      <PanelHeader title={panel === "tasks" ? "Tasks" : "Chat"} onClose={onClose} />

      {panel === "tasks" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <TasksPanel
            activeTasks={activeTasks}
            completedTasks={completedTasks}
            onCompleteTask={onCompleteTask}
            onUncompleteTask={onUncompleteTask}
            onAddTask={onAddTask}
            onDeleteTask={onDeleteTask}
            onEditTask={onEditTask}
            onReorderTasks={onReorderTasks}
          />
        </div>
      )}
      {panel === "chat" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatContent messages={messages} onSendMessage={onSendMessage} />
        </div>
      )}
    </>
  );
});
