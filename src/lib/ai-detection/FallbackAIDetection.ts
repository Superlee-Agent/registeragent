import OpenAI from 'openai';
import { AdvancedAnalysisResult, SimpleRecommendation } from '@/types/ai-detection';
import { getChatModel } from '@/lib/openai';

export class FallbackAIDetection {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeImageBasic(imageUrl: string): Promise<{ analysis: AdvancedAnalysisResult; recommendation: SimpleRecommendation }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image and determine strictly, being conservative:
1. Is it AI-generated? (boolean) with confidence 0-1
2. Overall quality score (1-10)
3. Suitable for IP registration? (boolean)
4. Recommended license type (commercial/nonCommercial/remix)
Return JSON only with keys: isAIGenerated, confidence, qualityScore, ipEligible, recommendedLicense, reasoning.`
              },
              { type: "image_url", image_url: { url: imageUrl, detail: 'low' } }
            ]
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Conservative post-processing
      const parsedQuality = Number(result.qualityScore || 5);
      const score = Math.max(1, Math.min(10, parsedQuality));
      let isAIGenerated = Boolean(result.isAIGenerated);
      const confidence = Math.max(0, Math.min(1, Number(result.confidence || 0)));
      // Require high confidence to flag as AI
      if (confidence < 0.85) isAIGenerated = false;

      const computedScore = score * 10;
      let ipEligible = typeof result.ipEligible === 'boolean' ? result.ipEligible : computedScore >= 60;
      if (computedScore >= 60 && !isAIGenerated) ipEligible = true; // keep consistent

      // Policy: human-created defaults to Commercial Remix
      const primary: 'commercial' | 'nonCommercial' | 'remix' = isAIGenerated ? (result.recommendedLicense || 'nonCommercial') : 'remix';
      const mintingFee = primary === 'remix' ? (score > 5 ? 50 : 0) : (primary === 'commercial' ? 50 : 0);
      const commercialRevShare = primary === 'remix' ? 10 : (primary === 'commercial' ? 10 : 0);
      const derivativesAllowed = primary === 'remix';
      const commercialUse = primary === 'remix' || primary === 'commercial';

      // Convert simple result to advanced format
      const analysis: AdvancedAnalysisResult = {
        aiDetection: {
          isAIGenerated,
          confidence,
          indicators: isAIGenerated ? ["Basic AI pattern detection"] : [],
          aiModel: undefined,
          learningRestriction: isAIGenerated ? 'disabled' : 'enabled'
        },
        qualityAssessment: {
          overall: score,
          technical: {
            resolution: score,
            sharpness: score,
            composition: score,
            lighting: score,
            colorBalance: score
          },
          artistic: {
            creativity: score,
            originality: score,
            aesthetics: score,
            concept: score
          }
        },
        ipEligibility: {
          isEligible: ipEligible,
          score: computedScore,
          reasons: ipEligible ? ["Basic quality assessment passed"] : ["Basic quality assessment failed"],
          risks: isAIGenerated ? ["AI-generated content has limited IP protection"] : [],
          requirements: ipEligible ? [] : ["Improve image quality or authenticity"]
        },
        licenseRecommendation: {
          primary,
          confidence: 0.7,
          reasoning: result.reasoning || (isAIGenerated ? "AI content: restrict AI training; recommend remix if allowed" : "Human content: default to Commercial Remix (commercial + derivatives)"),
          aiLearningAllowed: !isAIGenerated,
          robotTerms: {
            userAgent: '*',
            allow: isAIGenerated ? "Disallow: /" : "Allow: /"
          },
          suggestedTerms: {
            mintingFee,
            commercialRevShare,
            derivativesAllowed,
            commercialUse,
            aiTrainingRestricted: isAIGenerated
          }
        },
        content: {
          type: "image",
          category: "digital content",
          description: "Content analyzed with basic AI detection",
          tags: isAIGenerated ? ["AI-Generated", "Basic-Analysis"] : ["Human-Created", "Basic-Analysis"],
          marketValue: score > 7 ? 'high' : score > 5 ? 'medium' : 'low'
        }
      };

      const recommendation: SimpleRecommendation = {
        status: analysis.aiDetection.isAIGenerated ? 'ai-restricted' : (analysis.qualityAssessment.overall > 7 ? 'good' : 'fair'),
        message: analysis.aiDetection.isAIGenerated ?
          '⚠️ High-confidence AI content detected (fallback)' :
          `✅ Human content detected (quality: ${analysis.qualityAssessment.overall}/10)`,
        action: analysis.aiDetection.isAIGenerated ?
          'Register with AI restrictions' :
          'Register with Commercial Remix',
        license: analysis.aiDetection.isAIGenerated ? (analysis.licenseRecommendation.primary === 'remix' ? 'Commercial Remix' : 'Non-Commercial') : 'Commercial Remix',
        aiLearning: analysis.aiDetection.isAIGenerated ? '🚫 Restricted (basic protection)' : '✅ Your choice'
      };

      return { analysis, recommendation };

    } catch (error) {
      console.error("Fallback AI analysis error:", error);
      throw error;
    }
  }
}
