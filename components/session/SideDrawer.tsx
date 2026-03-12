"use client";

import { useEffect, memo } from "react";
import type { TaskRecord, GoalRecord } from "@/lib/types";
import type { ChatMessage } from "@/lib/useChat";
import { PanelHeader } from "./PanelHeader";
import { TasksPanel } from "./TasksPanel";
import { ChatContent } from "./ChatFlyout";

interface SideDrawerProps {
  onClose: () => void;
  panel: "commitments" | "chat";
  // Tasks
  activeTasks: TaskRecord[];
  completedTasks: TaskRecord[];
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, newText: string) => void;
  onReorderTasks: (activeId: string, overId: string) => void;
  // Goal context (optional)
  activeGoal?: GoalRecord | null;
  goalTasks?: TaskRecord[];
  onSetSprintGoal?: (taskId: string) => void;
  onAISuggest?: () => void;
  isAISuggesting?: boolean;
  // Active commitment
  activeTaskId?: string | null;
  onActivateTask?: (taskId: string) => void;
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
  activeGoal,
  goalTasks,
  onSetSprintGoal,
  onAISuggest,
  isAISuggesting,
  activeTaskId,
  onActivateTask,
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
      <PanelHeader title={panel === "commitments" ? "Commitments" : "Chat"} onClose={onClose} />

      {panel === "commitments" && (
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
            activeGoal={activeGoal}
            goalTasks={goalTasks}
            onSetSprintGoal={onSetSprintGoal}
            onAISuggest={onAISuggest}
            isAISuggesting={isAISuggesting}
            activeTaskId={activeTaskId}
            onActivateTask={onActivateTask}
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
