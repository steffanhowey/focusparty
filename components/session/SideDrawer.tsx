"use client";

import { useState, useEffect } from "react";
import type { Task } from "@/lib/types";
import type { ChatMessage } from "@/lib/useChat";
import { TasksPanel } from "./TasksPanel";
import { ChatContent } from "./ChatFlyout";

type DrawerTab = "tasks" | "chat";

interface SideDrawerProps {
  onClose: () => void;
  // Tasks
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onSelectTask: (taskId: string) => void;
  onAddTask: (text: string) => Task;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  // Chat
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

const TABS: { key: DrawerTab; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "chat", label: "Chat" },
];

export function SideDrawer({
  onClose,
  activeTask,
  activeTasks,
  completedTasks,
  onSelectTask,
  onAddTask,
  onCompleteTask,
  onDeleteTask,
  messages,
  onSendMessage,
}: SideDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("tasks");

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
      {/* Header: toggle */}
      <div className="px-4 py-3">
        <div className="flex rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-[var(--color-accent-primary)] text-white"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "tasks" ? (
        <TasksPanel
          activeTask={activeTask}
          activeTasks={activeTasks}
          completedTasks={completedTasks}
          onSelectTask={onSelectTask}
          onAddTask={onAddTask}
          onCompleteTask={onCompleteTask}
          onDeleteTask={onDeleteTask}
        />
      ) : (
        <ChatContent messages={messages} onSendMessage={onSendMessage} />
      )}
    </>
  );
}
