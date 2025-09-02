export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { AdvancedAIDetectionWithLearningControl } from "@/lib/ai-detection/AdvancedAIDetectionWithLearningControl";
import { FallbackAIDetection } from "@/lib/ai-detection/FallbackAIDetection";
import { AdvancedAnalysisResult } from "@/types/ai-detection";
import { createHash } from "crypto";

// Simple in-memory cache for analysis results
const CACHE_TTL = Number.parseInt(process.env.ANALYZE_ADV_TTL_MS || '300000', 10);
const advCache = new Map<string, { ts: number; payload: any }>();

// Preset answer blocks (1-12) used for deterministic UI display
const PRESET_ANSWERS: Record<number, string> = {
  1: `This is an AI-generated image.
No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommended

Commercial Remix License (minting fee & revenue share set manually).
– AI training not allowed (fixed, cannot be changed manually).`,
  2: `This is an AI-generated image.
Contains brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to Submit Review.`,
  3: `This is an AI-generated image.
Contains an ordinary human face (not famous).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training not allowed.
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).`,
  4: `This is a human-made image.
No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommends "Commercial Remix" License (minting fee & revenue share set manually).
– AI training allowed (user can set manually).`,
  5: `This is a human-made image.
Contains brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to "Submit Review".`,
  6: `This is a human-made image.
Contains an ordinary human face (not a celebrity or famous character).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training allowed (user can set manually).
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).`,
  7: `This is an AI-generated image.
This is an animation. No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommended

Commercial Remix License (minting fee & revenue share set manually).
– AI training not allowed (fixed, cannot be changed manually).`,
  8: `This is an AI-generated image.
This is an animation containing brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to Submit Review.`,
  9: `This is an AI-generated image.
This is an animation containing an ordinary human face (not famous).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training allowed (user can set manually).
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).`,
  10: `This is a human-made image.
This is an animation. No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommends "Commercial Remix" License (minting fee & revenue share set manually).
– AI training allowed (user can set manually).`,
  11: `This is a human-made image.
This is an animation containing brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to "Submit Review".`,
  12: `This is a human-made image.
This is an animation containing an ordinary human face (not a celebrity or famous character).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training allowed (user can set manually).
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).`,
};

function derivePresetClassificationFromAnalysis(analysis: AdvancedAnalysisResult): { id: number; text: string } {
  const isAI = !!analysis?.aiDetection?.isAIGenerated;
  const isAnimation = String(analysis?.content?.type || '').toLowerCase() === 'animation';
  const famous = !!(analysis?.content?.famousBrandOrCharacterDetected || analysis?.content?.famousPersonDetected);
  const hasOrdinaryFace = !!analysis?.content?.containsHumanFace && !famous;

  let id = 4; // default
  if (isAI) {
    if (isAnimation) {
      id = famous ? 8 : (hasOrdinaryFace ? 9 : 7);
    } else {
      id = famous ? 2 : (hasOrdinaryFace ? 3 : 1);
    }
  } else {
    if (isAnimation) {
      id = famous ? 11 : (hasOrdinaryFace ? 12 : 10);
    } else {
      id = famous ? 5 : (hasOrdinaryFace ? 6 : 4);
    }
  }
  return { id, text: PRESET_ANSWERS[id] };
}

export async function POST(req: Request) {
  try {
    const { imageUrl, imageBase64, userAddress } = await req.json();
    
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

    // Convert base64 to data URL if needed
    let finalImageUrl = imageUrl;
    if (imageBase64 && !imageUrl) {
      finalImageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    let analysis: AdvancedAnalysisResult;
    let simpleRecommendation: any;
    let detector: AdvancedAIDetectionWithLearningControl | null = null;
    let classification: { id: number; text: string } | null = null;

    // Cache check (hash of input URL)
    const cacheKey = createHash('sha1').update(String(finalImageUrl)).digest('hex');
    const cached = advCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      return NextResponse.json(cached.payload);
    }

    try {
      // Prefer simplified preset classification flow for immediate decisioning
      detector = new AdvancedAIDetectionWithLearningControl();
      const preset = await detector.analyzeImagePreset(finalImageUrl);
      analysis = preset.analysis;
      simpleRecommendation = detector.getSimpleRecommendationWithAIControl(analysis);
      classification = preset.classification;
      // Attach classification marker
      analysis.content.tags = Array.from(new Set([...(analysis.content.tags || []), `Preset-Answer-${preset.classification.id}`]));
    } catch (advancedError) {
      console.warn("Preset classification failed, using basic fallback:", advancedError);
      try {
        const fallbackDetector = new FallbackAIDetection();
        const fallbackResult = await fallbackDetector.analyzeImageBasic(finalImageUrl);
        analysis = fallbackResult.analysis;
        simpleRecommendation = fallbackResult.recommendation;
        analysis.content.tags.push("Fallback-Analysis");
        simpleRecommendation.message += " (using fallback analysis)";
      } catch (fallbackError) {
        console.error("All analysis strategies failed:", fallbackError);
        throw new Error(`Analysis failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
    }

    // Ensure we always return a preset classification block
    if (!classification) {
      try {
        const derived = derivePresetClassificationFromAnalysis(analysis);
        classification = derived;
        analysis.content.tags = Array.from(new Set([...(analysis.content.tags || []), `Derived-Preset-Answer-${derived.id}`]));
      } catch {}
    }

    // Generate enhanced metadata if user address provided
    let metadata = null;
    if (userAddress) {
      // Ensure we have a detector instance for metadata utilities
      if (!detector) detector = new AdvancedAIDetectionWithLearningControl();
      metadata = await detector.generateAdvancedMetadataWithAIControls(
        finalImageUrl,
        analysis,
        userAddress
      );
    }

    const payload = {
      success: true,
      analysis,
      recommendation: simpleRecommendation,
      metadata,
      classification,
      insights: {
        aiDetection: {
          status: analysis.aiDetection.isAIGenerated ? 'AI-Generated' : 'Human-Created',
          confidence: `${Math.round(analysis.aiDetection.confidence * 100)}%`,
          learningRestriction: analysis.aiDetection.learningRestriction,
          indicators: analysis.aiDetection.indicators
        },
        quality: {
          overall: analysis?.qualityAssessment?.overall ?? 0,
          technical: analysis?.qualityAssessment?.technical ?? { resolution: 0, sharpness: 0, composition: 0, lighting: 0, colorBalance: 0 },
          artistic: analysis?.qualityAssessment?.artistic ?? { creativity: 0, originality: 0, aesthetics: 0, concept: 0 }
        },
        ipEligibility: {
          eligible: analysis?.ipEligibility?.isEligible ?? false,
          score: analysis?.ipEligibility?.score ?? 0,
          risks: analysis?.ipEligibility?.risks ?? [],
          requirements: analysis?.ipEligibility?.requirements ?? []
        },
        license: {
          recommended: analysis?.licenseRecommendation?.primary ?? 'remix',
          aiTrainingRestricted: analysis?.licenseRecommendation?.suggestedTerms?.aiTrainingRestricted ?? false,
          mintingFee: analysis?.licenseRecommendation?.suggestedTerms?.mintingFee ?? 0,
          commercialRevShare: analysis?.licenseRecommendation?.suggestedTerms?.commercialRevShare ?? 0
        }
      },
      timestamp: new Date().toISOString(),
      version: "3.0-AI-Control"
    } as const;

    advCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload);

  } catch (error) {
    console.error("Advanced AI analysis error:", error);

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = {
      message: errorMessage,
      name: error instanceof Error ? error.name : "UnknownError",
      stack: error instanceof Error ? error.stack : undefined
    };

    return NextResponse.json({
      success: false,
      error: "Failed to perform advanced AI analysis",
      details: errorMessage,
      debugInfo: errorDetails,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: "Advanced AI Analysis",
    version: "3.0-AI-Control",
    description: "Comprehensive AI detection, quality assessment, and IP eligibility analysis",
    endpoints: {
      POST: "Analyze image with full advanced AI detection capabilities",
      GET: "Service information"
    },
    features: [
      "AI Content Detection",
      "Quality Assessment (Technical + Artistic)",
      "IP Eligibility Scoring", 
      "License Recommendations with AI Controls",
      "Metadata Generation",
      "Robot Terms for AI Training Control"
    ]
  });
}
