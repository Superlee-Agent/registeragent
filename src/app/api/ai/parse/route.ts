export const runtime = "nodejs";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getChatModel } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ available: false }, { status: 200 });

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: getChatModel(),
      messages: [
        {
          role: 'system',
          content: `You parse user commands for a DeFi/IP platform.
Return a JSON with fields: intent ('swap'|'register'|'unknown'), confidence (0..1), extractedData{tokenIn,tokenOut,amount,slippage,title,description,license}, naturalResponse.
Be concise.`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return NextResponse.json({ ok: true, data: JSON.parse(content) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'ai-parse-failed' }, { status: 200 });
  }
}
