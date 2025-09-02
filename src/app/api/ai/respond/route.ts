export const runtime = "nodejs";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getChatModel } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { userMessage, context, intent } = await req.json();
    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ available: false }, { status: 200 });

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: 'system', content: `You are SuperLee, a concise helpful assistant for a DeFi/IP platform. Context: ${context || ''}. Intent: ${intent || 'general'}.` },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content || '';
    return NextResponse.json({ ok: true, data: content });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'ai-respond-failed' }, { status: 200 });
  }
}
