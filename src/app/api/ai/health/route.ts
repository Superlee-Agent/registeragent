export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getChatModel } from "@/lib/openai";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        status: "error",
        message: "OpenAI API key not configured",
        checks: {
          apiKeyConfigured: false,
          openaiConnection: false,
          modelAccess: false
        }
      });
    }

    // Test OpenAI connection
    const openai = new OpenAI({ apiKey });
    
    try {
      // Simple test call to check if API key works
      const testResponse = await openai.chat.completions.create({
        model: getChatModel(),
        messages: [{ role: "user", content: "Hello, respond with 'OK'" }],
        temperature: 0
      });

      const hasResponse = testResponse.choices[0]?.message?.content;

      return NextResponse.json({
        status: "healthy",
        message: "AI Detection system is operational",
        checks: {
          apiKeyConfigured: true,
          openaiConnection: true,
          modelAccess: !!hasResponse,
          testResponse: hasResponse
        },
        features: [
          "AI Content Detection",
          "Quality Assessment",
          "IP Eligibility Scoring",
          "License Recommendations",
          "AI Learning Controls"
        ],
        models: {
          primary: getChatModel(),
          fallback: "gpt-3.5-turbo"
        }
      });

    } catch (openaiError) {
      return NextResponse.json({
        status: "error",
        message: "OpenAI API connection failed",
        checks: {
          apiKeyConfigured: true,
          openaiConnection: false,
          modelAccess: false
        },
        error: openaiError instanceof Error ? openaiError.message : "Unknown OpenAI error"
      });
    }

  } catch (error) {
    return NextResponse.json({
      status: "error", 
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function POST() {
  return NextResponse.json({
    message: "Use GET method for health check"
  }, { status: 405 });
}
