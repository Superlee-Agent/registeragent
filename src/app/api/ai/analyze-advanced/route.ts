export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { AdvancedAIDetectionWithLearningControl } from "@/lib/ai-detection/AdvancedAIDetectionWithLearningControl";
import { FallbackAIDetection } from "@/lib/ai-detection/FallbackAIDetection";
import { AdvancedAnalysisResult } from "@/types/ai-detection";

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

    try {
      // Prefer simplified preset classification flow for immediate decisioning
      detector = new AdvancedAIDetectionWithLearningControl();
      const preset = await detector.analyzeImagePreset(finalImageUrl);
      analysis = preset.analysis;
      simpleRecommendation = detector.getSimpleRecommendationWithAIControl(analysis);
      // Attach classification marker
      analysis.content.tags = Array.from(new Set([...(analysis.content.tags || []), `Preset-Answer-${preset.classification.id}`]));
    } catch (advancedError) {
      console.warn("Preset classification failed, trying legacy advanced analysis:", advancedError);

      try {
        // Legacy advanced analysis as fallback
        detector = detector || new AdvancedAIDetectionWithLearningControl();
        analysis = await detector.analyzeImage(finalImageUrl);
        simpleRecommendation = detector.getSimpleRecommendationWithAIControl(analysis);
      } catch (legacyError) {
        console.warn("Advanced analysis failed, trying basic fallback:", legacyError);
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

    return NextResponse.json({
      success: true,
      analysis,
      recommendation: simpleRecommendation,
      metadata,
      insights: {
        aiDetection: {
          status: analysis.aiDetection.isAIGenerated ? 'AI-Generated' : 'Human-Created',
          confidence: `${Math.round(analysis.aiDetection.confidence * 100)}%`,
          learningRestriction: analysis.aiDetection.learningRestriction,
          indicators: analysis.aiDetection.indicators
        },
        quality: {
          overall: analysis.qualityAssessment.overall,
          technical: analysis.qualityAssessment.technical,
          artistic: analysis.qualityAssessment.artistic
        },
        ipEligibility: {
          eligible: analysis.ipEligibility.isEligible,
          score: analysis.ipEligibility.score,
          risks: analysis.ipEligibility.risks,
          requirements: analysis.ipEligibility.requirements
        },
        license: {
          recommended: analysis.licenseRecommendation.primary,
          aiTrainingRestricted: analysis.licenseRecommendation.suggestedTerms.aiTrainingRestricted,
          mintingFee: analysis.licenseRecommendation.suggestedTerms.mintingFee,
          commercialRevShare: analysis.licenseRecommendation.suggestedTerms.commercialRevShare
        }
      },
      timestamp: new Date().toISOString(),
      version: "3.0-AI-Control"
    });

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
