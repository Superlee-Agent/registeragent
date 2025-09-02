import { NextResponse } from "next/server";
import { AdvancedAIDetectionWithLearningControl } from "@/lib/ai-detection/AdvancedAIDetectionWithLearningControl";
import { AdvancedAnalysisResult } from "@/types/ai-detection";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { imageUrl, imageBase64 } = await req.json();

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({
        error: "Either imageUrl or imageBase64 is required"
      }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "OpenAI API key not configured"
      }, { status: 500 });
    }

    const detector = new AdvancedAIDetectionWithLearningControl();

    // Convert base64 to data URL if needed
    let finalImageUrl = imageUrl;
    if (imageBase64 && !imageUrl) {
      finalImageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    const analysis: AdvancedAnalysisResult = await detector.analyzeImage(finalImageUrl);
    const simpleRecommendation = detector.getSimpleRecommendationWithAIControl(analysis);

    return NextResponse.json({
      success: true,
      analysis,
      recommendation: simpleRecommendation,
      timestamp: new Date().toISOString(),
      version: "3.0-AI-Control"
    });

  } catch (error) {
    console.error("Advanced AI detection error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to analyze image with advanced AI detection",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: "Advanced AI Detection with Learning Control",
    version: "3.0-AI-Control",
    features: [
      "AI Content Detection",
      "Auto-disable AI Learning",
      "Quality Assessment",
      "IP Eligibility Scoring",
      "License Recommendations",
      "Robot Terms Generation"
    ],
    status: "active"
  });
}
