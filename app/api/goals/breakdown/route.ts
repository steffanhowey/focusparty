import { NextResponse } from "next/server";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export async function POST(request: Request) {
  try {
    const { goalTitle, goalDescription, existingTasks } = await request.json();

    if (!goalTitle || typeof goalTitle !== "string") {
      return NextResponse.json(
        { error: "goalTitle is required" },
        { status: 400 }
      );
    }

    const existingList =
      Array.isArray(existingTasks) && existingTasks.length > 0
        ? `\n\nExisting tasks (do not repeat):\n${existingTasks.map((t: string) => `- ${t}`).join("\n")}`
        : "";

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You break goals into actionable tasks for a focus/sprint app. Each task should be completable in one 25–50 minute session. Return 3–7 tasks ordered from first to last. Be specific and concrete, not vague.`,
        },
        {
          role: "user",
          content: `Goal: ${goalTitle}${goalDescription ? `\nDescription: ${goalDescription}` : ""}${existingList}\n\nBreak this into concrete tasks.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "task_breakdown",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tasks"],
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
    console.error("[goals/breakdown] Error:", err);
    return NextResponse.json(
      { error: "Failed to break down goal" },
      { status: 500 }
    );
  }
}
