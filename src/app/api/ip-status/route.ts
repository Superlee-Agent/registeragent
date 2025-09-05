export const runtime = "nodejs";

import OpenAI from 'openai';
import { getChatModel } from '@/lib/openai';
import crypto from 'node:crypto';

// Note: OpenAI client will be created inside the handler if needed

const IP_STATUS_CACHE_TTL_MS = Number.parseInt(process.env.IP_STATUS_CACHE_TTL_MS || '21600000', 10);
const ipStatusCache = new Map<string, { ts: number; payload: any }>();

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6MB

function clip(s: string, max = 280) {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function extractJsonObject(text: string): any | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson) { try { return JSON.parse(fencedJson[1]); } catch {} }
  const fenced = text.match(/```\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const s = String(text);
  const start = s.indexOf('{');
  if (start >= 0) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
      else { if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { const cand = s.slice(start, i + 1); try { return JSON.parse(cand); } catch {} break; } } }
    }
  }
  const lower = text.toLowerCase();
  const kv: any = {};
  const mStatus = lower.match(/status\s*[:\-]\s*([\s\S]*?)(?:\n|,|$)/);
  const mRisk = lower.match(/risk\s*[:\-]\s*([\s\S]*?)(?:\n|,|$)/);
  const mTol = lower.match(/tolerance\s*[:\-]\s*([\s\S]*?)(?:\n|,|$)/);
  if (mStatus) kv.status = mStatus[1].trim();
  if (mRisk) kv.risk = mRisk[1].trim();
  if (mTol) kv.tolerance = mTol[1].trim();
  return kv.status || kv.risk || kv.tolerance ? kv : null;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    let file: File | null = null;
    try { file = (form as any).get?.("file") as File | null; } catch {}
    if (!file) {
      try { for (const [k, v] of ((form as any).entries?.() || [])) { if (k === 'file' && v) { file = v as File; break; } } } catch {}
    }
    if (!file) return Response.json({ error: 'No file found.' }, { status: 400 });
    if (!ALLOWED.has(file.type)) return Response.json({ error: 'File must be PNG/JPEG/WEBP.' }, { status: 415 });
    if (file.size > MAX_BYTES) return Response.json({ error: 'File too big! Max 6MB.' }, { status: 413 });

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    const cached = ipStatusCache.get(hash);
    if (cached && Date.now() - cached.ts < IP_STATUS_CACHE_TTL_MS) {
      return Response.json(cached.payload);
    }

    const dataUrl = `data:${file.type};base64,${buf.toString('base64')}`;

    const systemPrompt = [
      'You are an IP compliance assistant. Decide if an image is safe to register as IP, whether it qualifies as fair use, and whether it is AI-generated.',
      'Return ONLY a raw JSON object (no backticks, no markdown) with keys exactly:',
      '{',
      '  "status": "...",',
      '  "risk": "...",',
      '  "tolerance": "...",',
      '  "ai_generated": true | false,',
      '  "ai_confidence": 0.0,',
      '  "fair_use": true | false,',
      '  "fair_use_reason": "...",',
      '  "flags": {',
      '    "logo_brand": true | false,',
      '    "copyrighted_character": true | false,',
      '    "watermark": true | false,',
      '    "visible_text": true | false,',
      '    "face_identity": true | false,',
      '    "nsfw": true | false,',
      '    "illegal": true | false,',
      '    "derivative_trace": true | false',
      '  },',
      '  "allow_register": true | false,',
      '  "require_review": true | false',
      '}',
      'Rules:',
      '- Be conservative by default. If unsure, set risk to "Medium" and tolerance to a cautionary message.',
      '- Only use tolerance starting with "Good to register" when you are confident and risk is "Low".',
      '- Evaluate: logos/brands, copyrighted characters, watermarks, visible text, faces/identity, tracing/derivatives, NSFW/illegal.',
      '- Consider fair use categories. If incidental/background use is evident, set fair_use=true with brief reason.',
      '- For ai_generated, output boolean. ai_confidence is 0..1 (two decimals max).',
      '- Keep fields ≤ 280 chars. No extra fields, no prose, no code fences.'
    ].join('\n');

    let raw = '';
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return Response.json({ error: 'AI not configured' }, { status: 200 });
    }

    if (geminiKey) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const body = {
        contents: [{
          role: 'user',
          parts: [
            { text: systemPrompt + '\nAnalyze for IP safety, fair use, and AI-generation. Return only the JSON object.' },
            { inline_data: { mime_type: file.type, data: dataUrl.split(',')[1] } }
          ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 200 }
      };
      const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const jr: any = await r.json();
      raw = jr?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const openai = new OpenAI({ apiKey: openaiKey! });
      const completion = await openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'text', text: 'Analyze for IP safety, fair use, and AI-generation. Return only the JSON object.' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }
          ] as any }
        ],
        temperature: 1,
        top_p: 0,
        response_format: { type: 'json_object' }
      }, { timeout: 4000 });
      raw = completion.choices[0]?.message?.content ?? '{}';
    }
    const extracted = extractJsonObject(raw) || {};
    if (!extracted || typeof extracted !== 'object') {
      return Response.json({ error: 'Invalid AI response' }, { status: 200 });
    }

    let status = clip(extracted.status || '');
    let risk = clip(extracted.risk || '');
    let tolerance = clip(extracted.tolerance || '');

    const aiGenerated = !!extracted.ai_generated;
    let aiConfidence = typeof extracted.ai_confidence === 'number' ? extracted.ai_confidence : 0;
    if (!isFinite(aiConfidence)) aiConfidence = 0; aiConfidence = Math.max(0, Math.min(1, Number(aiConfidence.toFixed(2))));

    const fairUse = !!extracted.fair_use;
    const fairUseReason = clip(extracted.fair_use_reason || '');

    const f = extracted.flags || {};
    const flags = {
      logo_brand: !!f.logo_brand,
      copyrighted_character: !!f.copyrighted_character,
      watermark: !!f.watermark,
      visible_text: !!f.visible_text,
      face_identity: !!f.face_identity,
      nsfw: !!f.nsfw,
      illegal: !!f.illegal,
      derivative_trace: !!f.derivative_trace,
    };

    const strict = (process.env.IP_STATUS_STRICT ?? 'true') === 'true';
    let allowRegister = false;
    let requireReview = false;

    if (strict) {
      const hasSevere = flags.illegal || flags.nsfw;
      const rightsSensitive = flags.logo_brand || flags.copyrighted_character || flags.watermark || flags.derivative_trace;
      const riskLower = (risk || '').toLowerCase();
      const tolLower = (tolerance || '').toLowerCase();

      if (hasSevere) { risk = 'High'; tolerance = 'Do not register'; allowRegister = false; }
      else if (fairUse) { risk = 'Low'; tolerance = 'Good to register (fair use)'; allowRegister = true; }
      else if (!rightsSensitive && !flags.face_identity) { risk = 'Low'; tolerance = 'Good to register'; allowRegister = true; }
      else if (flags.watermark || flags.derivative_trace) { risk = 'High'; tolerance = 'Do not register (watermark/derivative)'; allowRegister = false; }
      else { risk = risk || 'Medium'; tolerance = tolerance || 'Proceed with caution, manual review recommended'; requireReview = true; }

      if (tolLower.startsWith('good to register') && !riskLower.includes('low') && !fairUse) tolerance = 'Proceed with caution';
      if (!tolerance) tolerance = 'Proceed with caution';
      if (!status) status = 'Automated assessment completed';
    } else {
      if (!status) status = 'Assessment by OpenAI';
      if (!risk) risk = 'Unknown';
      if (!tolerance) tolerance = 'Proceed with caution';
    }

    const aiLine = `AI: ${aiGenerated ? 'AI-generated' : 'Original'} (${Math.round(aiConfidence * 100)}%)`;
    const fairUseLine = `Fair Use: ${fairUse ? 'Yes' : 'No'}${fairUse && fairUseReason ? ` — ${fairUseReason}` : ''}`;
    const flagsLine = `Flags: ${Object.entries(flags).filter(([_,v])=>v).map(([k])=>k).join(', ') || 'None'}`;
    const decisionLine = `Decision: ${allowRegister ? 'Allow' : (requireReview ? 'Manual Review' : 'Do not register')}`;

    const formatted = [
      `Status: ${status}`,
      `Risk: ${risk}`,
      `Tolerance: ${tolerance}`,
      aiLine,
      fairUseLine,
      flagsLine,
      decisionLine,
    ].join('\n');

    const payload = { result: formatted, aiGenerated, aiConfidence, fairUse, fairUseReason, flags, allowRegister, requireReview };
    ipStatusCache.set(hash, { ts: Date.now(), payload });
    return Response.json(payload);
  } catch (err) {
    return Response.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
