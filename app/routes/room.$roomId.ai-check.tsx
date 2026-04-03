import Anthropic from "@anthropic-ai/sdk";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export interface AiCheckResult {
  correct: boolean;
  reasoning: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const playerAnswer = formData.get("playerAnswer");
  if (typeof playerAnswer !== "string" || !playerAnswer.trim()) {
    throw new Response("Invalid playerAnswer", { status: 400 });
  }

  const correctAnswer = formData.get("correctAnswer");
  if (typeof correctAnswer !== "string") {
    throw new Response("Invalid correctAnswer", { status: 400 });
  }

  const clueText = formData.get("clueText");
  if (typeof clueText !== "string") {
    throw new Response("Invalid clueText", { status: 400 });
  }

  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `You are a Jeopardy host evaluating a contestant's answer.

Clue: ${clueText}
Correct answer: ${correctAnswer}
Contestant's answer: ${playerAnswer}

Rules:
- Accept answers with or without "What is..." / "Who is..." phrasing
- Accept reasonable name variations (e.g., "Washington" for "George Washington")
- Accept phonetically similar spellings of names
- Accept common abbreviations and alternate titles
- The contestant must provide a specific answer, not a vague non-answer
- Be lenient: if the key identifying information is correct, accept it

Respond with ONLY valid JSON, no other text: {"correct": true, "reasoning": "one brief sentence"}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Response("Unexpected AI response type", { status: 500 });
  }

  try {
    const parsed = JSON.parse(content.text) as {
      correct: unknown;
      reasoning: unknown;
    };
    return json<AiCheckResult>({
      correct: Boolean(parsed.correct),
      reasoning: String(parsed.reasoning ?? ""),
    });
  } catch {
    throw new Response("Failed to parse AI response", { status: 500 });
  }
}
