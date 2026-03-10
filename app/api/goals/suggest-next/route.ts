import { NextResponse } from "next/server";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export async function POST(request: Request) {
  try {
    const { goalTitle, tasks } = await request.json();

    if (!goalTitle || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: "goalTitle and tasks array required" },
        { status: 400 }
      );
    }

    const taskList = tasks
      .map(
        (t: { title: string; status: string; id?: string }) =>
          `- [${t.status}] ${t.title}`
      )
      .join("\n");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      messages: [
        {
          role: "system",
          content: `You help users pick their next focus task. Given a goal and its tasks with statuses, suggest the single best task to work on next. Prefer tasks that are "todo" or "in_progress". If all tasks are done, suggest a new task. Be brief.`,
        },
        {
          role: "user",
          content: `Goal: ${goalTitle}\n\nTasks:\n${taskList}\n\nWhat should I work on in my next sprint?`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "next_task_suggestion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestedTaskTitle: { type: "string" },
              reason: { type: "string" },
              isExistingTask: { type: "boolean" },
            },
            required: ["suggestedTaskTitle", "reason", "isExistingTask"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "Empty AI response" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[goals/suggest-next] Error:", err);
    return NextResponse.json(
      { error: "Failed to suggest next task" },
      { status: 500 }
    );
  }
}
