export const runtime = "nodejs";

import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ available: false }, { status: 200 });

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `Analyze image for IP registration metadata. Return JSON: {description, suggestedTitle, detectedObjects[], style?, mood?}` },
        { role: 'user', content: [
          { type: 'text', text: 'Analyze this image and return structured JSON.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ] as any }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
      max_tokens: 400,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return NextResponse.json({ ok: true, data: JSON.parse(content) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'ai-analyze-failed' }, { status: 200 });
  }
}
