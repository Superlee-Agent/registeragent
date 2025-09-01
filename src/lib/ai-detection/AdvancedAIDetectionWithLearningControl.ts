import OpenAI from 'openai';
import { createHash } from 'crypto';
import { AdvancedAnalysisResult, SimpleRecommendation, AIMetadata } from '@/types/ai-detection';

export class AdvancedAIDetectionWithLearningControl {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeImage(imageUrl: string): Promise<AdvancedAnalysisResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image comprehensively and provide a detailed JSON response with the following structure:

{
  "aiDetection": {
    "isAIGenerated": boolean,
    "confidence": number (0-1),
    "indicators": ["specific visual clues that indicate AI generation"],
    "aiModel": "suspected AI model if detectable",
    "learningRestriction": "disabled|enabled|conditional"
  },
  "qualityAssessment": {
    "overall": number (1-10),
    "technical": {
      "resolution": number (1-10),
      "sharpness": number (1-10),
      "composition": number (1-10),
      "lighting": number (1-10),
      "colorBalance": number (1-10)
    },
    "artistic": {
      "creativity": number (1-10),
      "originality": number (1-10),
      "aesthetics": number (1-10),
      "concept": number (1-10)
    }
  },
  "ipEligibility": {
    "isEligible": boolean,
    "score": number (1-100),
    "reasons": ["why this is/isn't suitable for IP registration"],
    "risks": ["potential legal or commercial risks"],
    "requirements": ["what would be needed to make this IP-ready"]
  },
  "licenseRecommendation": {
    "primary": "commercial|nonCommercial|remix",
    "confidence": number (0-1),
    "reasoning": "detailed explanation for recommendation",
    "aiLearningAllowed": boolean,
    "robotTerms": {
      "userAgent": "string for robot.txt style blocking",
      "allow": "specific permissions or restrictions"
    },
    "suggestedTerms": {
      "mintingFee": number (in USD),
      "commercialRevShare": number (percentage 0-100),
      "derivativesAllowed": boolean,
      "commercialUse": boolean,
      "aiTrainingRestricted": boolean
    }
  },
  "content": {
    "type": "specific content type",
    "category": "art category",
    "description": "detailed description",
    "tags": ["relevant tags"],
    "marketValue": "low|medium|high|premium",
    "containsHumanFace": boolean,
    "faceCount": number,
    "famousPersonDetected": boolean,
    "famousBrandOrCharacterDetected": boolean
  }
}

Policy rules to apply to your JSON:
- If famousBrandOrCharacterDetected = true OR famousPersonDetected = true → set ipEligibility.isEligible = false and add reasons explaining the restriction (brand/character or celebrity detected). Keep score but mark ineligible.
- Be conservative in celebrity/brand detection: if the subject closely resembles a widely-known public figure (e.g., Elon Musk, Taylor Swift, Cristiano Ronaldo) or famous brand/character (e.g., Nike, Disney, Mickey Mouse), set the corresponding flag to true. When uncertain, prefer true over false negatives.
- If containsHumanFace = true AND famousPersonDetected = false → add a requirement: "Selfie verification required".
- License default should be "Commercial Remix" semantics (commercialUse=true and derivativesAllowed=true). Use primary = "remix" and set suggestedTerms accordingly.

CRITICAL AI LEARNING RULES:
1. If isAIGenerated = true AND confidence > 0.85, set aiLearningAllowed = false and aiTrainingRestricted = true
2. If isAIGenerated = true AND confidence is between 0.65 and 0.85, set learningRestriction = "conditional" and aiTrainingRestricted = true
3. For AI-generated content, create restrictive robotTerms to block AI crawlers
4. Human-created content can have aiLearningAllowed = true unless creator specifies otherwise

Analysis Guidelines:
1. AI Detection: Look for telltale signs like unnatural textures, impossible anatomy, inconsistent lighting, digital artifacts
2. Quality: Assess both technical excellence and artistic merit
3. IP Eligibility: Consider originality, commercial potential, legal risks
4. License Recommendation: Prioritize creator rights and AI training restrictions
5. AI Learning Control: Automatically restrict AI training for AI-generated content

Return ONLY valid JSON.`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Enhance analysis with business logic
      const enhancedAnalysis = this.enhanceAnalysisWithAIControls(analysis);
      
      console.log(`🔍 Advanced AI Analysis with Learning Control:`, enhancedAnalysis);
      return enhancedAnalysis;
    } catch (error) {
      console.error("Error analyzing image:", error);
      throw error;
    }
  }

  private enhanceAnalysisWithAIControls(rawAnalysis: any): AdvancedAnalysisResult {
    const enhanced: any = { ...rawAnalysis };

    // Safe defaults
    enhanced.aiDetection = enhanced.aiDetection || { isAIGenerated: false, confidence: 0, indicators: [] };
    enhanced.aiDetection.confidence = Math.max(0, Math.min(1, Number(enhanced.aiDetection.confidence || 0)));
    enhanced.aiDetection.indicators = Array.isArray(enhanced.aiDetection.indicators) ? enhanced.aiDetection.indicators : [];
    enhanced.content = enhanced.content || { tags: [] };
    enhanced.content.description = typeof enhanced.content.description === 'string' ? enhanced.content.description : '';
    enhanced.content.tags = Array.isArray(enhanced.content.tags) ? enhanced.content.tags : [];
    enhanced.content.containsHumanFace = Boolean(enhanced.content.containsHumanFace);
    enhanced.content.faceCount = Number.isFinite(enhanced.content.faceCount) ? enhanced.content.faceCount : 0;
    enhanced.content.famousPersonDetected = Boolean(enhanced.content.famousPersonDetected);
    enhanced.content.famousBrandOrCharacterDetected = Boolean(enhanced.content.famousBrandOrCharacterDetected);
    enhanced.licenseRecommendation = enhanced.licenseRecommendation || { suggestedTerms: {} };
    enhanced.licenseRecommendation.suggestedTerms = enhanced.licenseRecommendation.suggestedTerms || {};
    enhanced.ipEligibility = enhanced.ipEligibility || { score: 0, reasons: [], risks: [], requirements: [] };

    // Heuristic boost: infer celebrity/brand mentions from description/tags
    try {
      const text = `${enhanced.content.description} ${enhanced.content.tags.join(' ')}`.toLowerCase();
      const famousPeople = ['elon musk','taylor swift','barack obama','beyonce','rihanna','cristiano ronaldo','lionel messi','donald trump','bill gates','mark zuckerberg','selena gomez'];
      const brands = ['nike','adidas','apple','microsoft','google','coca-cola','mcdonalds','mcdonald\'s','disney','tesla','starbucks','samsung','netflix','amazon'];
      const characters = ['mickey','mickey mouse','minnie','spiderman','spider-man','batman','superman','pikachu','hello kitty','spongebob','doraemon','naruto'];
      if (!enhanced.content.famousPersonDetected && famousPeople.some(n => text.includes(n))) {
        enhanced.content.famousPersonDetected = true;
        enhanced.content.tags = Array.from(new Set([...(enhanced.content.tags||[]), 'Celebrity-Detected']));
      }
      if (!enhanced.content.famousBrandOrCharacterDetected && (brands.some(n => text.includes(n)) || characters.some(n => text.includes(n)))) {
        enhanced.content.famousBrandOrCharacterDetected = true;
        enhanced.content.tags = Array.from(new Set([...(enhanced.content.tags||[]), 'BrandOrCharacter-Detected']))
      }
    } catch {}

    const conf = enhanced.aiDetection.confidence;

    // Be conservative: if low confidence or no indicators, treat as human
    if (enhanced.aiDetection.isAIGenerated && (conf < 0.65 || enhanced.aiDetection.indicators.length === 0)) {
      enhanced.aiDetection.isAIGenerated = false;
      enhanced.aiDetection.learningRestriction = 'enabled';
      enhanced.licenseRecommendation.aiLearningAllowed = true;
      enhanced.licenseRecommendation.suggestedTerms.aiTrainingRestricted = false;
      enhanced.licenseRecommendation.robotTerms = { userAgent: '*', allow: 'Allow: / # Low confidence, treated as human' };
      enhanced.content.tags = [...enhanced.content.tags, 'Low-Confidence-Override'];
    }

    if (enhanced.aiDetection.isAIGenerated && conf >= 0.85) {
      // High confidence AI-generated
      enhanced.licenseRecommendation.aiLearningAllowed = false;
      enhanced.licenseRecommendation.suggestedTerms.aiTrainingRestricted = true;
      enhanced.aiDetection.learningRestriction = 'disabled';

      enhanced.licenseRecommendation.robotTerms = {
        userAgent: '*',
        allow: 'Disallow: /\nUser-agent: GPTBot\nDisallow: /\nUser-agent: ChatGPT-User\nDisallow: /\nUser-agent: CCBot\nDisallow: /\nUser-agent: anthropic-ai\nDisallow: /\nUser-agent: Claude-Web\nDisallow: /'
      };

      enhanced.content.tags = [
        ...enhanced.content.tags,
        'AI-Generated',
        'No-AI-Training',
        'Training-Restricted'
      ];

      enhanced.ipEligibility.score = Math.max(0, (enhanced.ipEligibility.score || 0) - 20);
      enhanced.ipEligibility.risks.push('AI-generated content has limited IP protection');
      enhanced.ipEligibility.requirements.push('Verify human creative input and authorship');

    } else if (enhanced.aiDetection.isAIGenerated && conf >= 0.65) {
      // Medium confidence AI-generated
      enhanced.aiDetection.learningRestriction = 'conditional';
      enhanced.licenseRecommendation.aiLearningAllowed = false;
      enhanced.licenseRecommendation.suggestedTerms.aiTrainingRestricted = true;

      enhanced.licenseRecommendation.robotTerms = {
        userAgent: 'AI-Crawlers',
        allow: 'Disallow: / # Conditional AI training restriction'
      };

    } else {
      // Human-created content
      enhanced.aiDetection.learningRestriction = 'enabled';
      enhanced.licenseRecommendation.aiLearningAllowed = true;
      enhanced.licenseRecommendation.suggestedTerms.aiTrainingRestricted = false;

      enhanced.licenseRecommendation.robotTerms = {
        userAgent: '*',
        allow: 'Allow: / # Human-created content, AI training allowed'
      };
    }

    // Apply policy flags: brand/celebrity block and selfie requirement
    if (enhanced.content.famousBrandOrCharacterDetected || enhanced.content.famousPersonDetected) {
      enhanced.ipEligibility.isEligible = false;
      enhanced.ipEligibility.reasons = Array.from(new Set([...(enhanced.ipEligibility.reasons||[]), enhanced.content.famousBrandOrCharacterDetected ? 'Contains famous brand/character' : 'Contains celebrity face']));
      enhanced.ipEligibility.risks = Array.from(new Set([...(enhanced.ipEligibility.risks||[]), 'High legal risk: trademark/publicity rights']));
    }
    if (enhanced.content.containsHumanFace && !enhanced.content.famousPersonDetected) {
      if (!enhanced.ipEligibility.requirements) enhanced.ipEligibility.requirements = [];
      if (!enhanced.ipEligibility.requirements.includes('Selfie verification required')) enhanced.ipEligibility.requirements.push('Selfie verification required');
    }

    // Enhance IP eligibility calculation
    enhanced.ipEligibility = this.calculateEnhancedIPEligibility(enhanced);

    // Refine license recommendation
    enhanced.licenseRecommendation = this.refineLicenseWithAIControls(enhanced);

    return enhanced as AdvancedAnalysisResult;
  }

  private calculateEnhancedIPEligibility(analysis: any): any {
    let score = 0;
    const reasons = [];
    const risks = [];
    const requirements = [];

    // Quality factors (35% weight)
    const qualityScore = analysis.qualityAssessment?.overall || 0;
    score += qualityScore * 3.5;
    
    // Originality factors (25% weight)
    const originalityScore = analysis.qualityAssessment?.artistic?.originality || 0;
    score += originalityScore * 2.5;

    // AI generation impact (25% weight)
    if (analysis.aiDetection?.isAIGenerated) {
      const aiConfidence = analysis.aiDetection.confidence || 0;
      if (aiConfidence > 0.8) {
        score -= 25;
        risks.push("High confidence AI-generated content has limited IP rights");
        risks.push("AI training restrictions automatically applied");
        requirements.push("Document human creative input and authorship");
      } else if (aiConfidence > 0.5) {
        score -= 15;
        risks.push("Possible AI generation complicates IP ownership");
        requirements.push("Verify creative process and human involvement");
      }
      reasons.push("AI training restrictions automatically enabled for protection");
    } else {
      score += 15;
      reasons.push("Human-created content with clear authorship and IP rights");
    }

    // Market potential (15% weight)
    const marketValue = analysis.content?.marketValue;
    if (marketValue === 'premium') {
      score += 15;
      reasons.push("Premium market potential with strong IP protection");
    } else if (marketValue === 'high') {
      score += 10;
      reasons.push("Strong commercial potential");
    }

    const finalScore = Math.max(0, Math.min(100, score));
    const isEligible = finalScore >= 50; // Lower threshold due to AI restrictions

    return {
      isEligible,
      score: finalScore,
      reasons,
      risks,
      requirements
    };
  }

  private refineLicenseWithAIControls(analysis: any): any {
    const quality = analysis.qualityAssessment?.overall || 0;
    const originality = analysis.qualityAssessment?.artistic?.originality || 0;
    const isAI = analysis.aiDetection?.isAIGenerated;
    const aiConfidence = analysis.aiDetection?.confidence || 0;

    let primary: 'commercial' | 'nonCommercial' | 'remix' = 'remix';
    let reasoning = '';
    let mintingFee = 0;
    let commercialRevShare = 5;
    let aiTrainingRestricted = false;

    if (isAI && aiConfidence >= 0.85) {
      primary = 'remix';
      reasoning = 'AI-generated content with high confidence. Recommended Commercial Remix with AI training disabled to protect rights.';
      mintingFee = 0;
      commercialRevShare = 0;
      aiTrainingRestricted = true;
      
    } else if (isAI && aiConfidence >= 0.65) {
      primary = 'remix';
      reasoning = 'Possible AI-generated content. Recommend Commercial Remix with AI training restrictions.';
      mintingFee = 5;
      commercialRevShare = 3;
      aiTrainingRestricted = true;
      
    } else if (quality >= 8 && originality >= 7) {
      primary = 'remix';
      reasoning = 'High-quality human-created content. Recommend Commercial Remix (commercial + derivatives with revenue sharing).';
      mintingFee = 100;
      commercialRevShare = 15;
      aiTrainingRestricted = false; // Creator can choose
      
    } else if (quality >= 6 && originality >= 5) {
      primary = 'remix';
      reasoning = 'Good quality human content. Recommend Commercial Remix with standard terms.';
      mintingFee = 50;
      commercialRevShare = 10;
      aiTrainingRestricted = false;
      
    } else {
      primary = 'nonCommercial';
      reasoning = 'Content quality suggests non-commercial sharing is most appropriate.';
      mintingFee = 0;
      commercialRevShare = 0;
      aiTrainingRestricted = false;
    }

    return {
      ...analysis.licenseRecommendation,
      primary,
      reasoning,
      suggestedTerms: {
        ...analysis.licenseRecommendation.suggestedTerms,
        mintingFee,
        commercialRevShare,
        aiTrainingRestricted
      }
    };
  }

  async generateAdvancedMetadataWithAIControls(
    imageUrl: string, 
    analysis: AdvancedAnalysisResult, 
    userAddress: string
  ): Promise<AIMetadata> {
    const imageHash = await this.getImageHash(imageUrl);
    
    const ipMetadata = {
      title: `${analysis.content.type} - ${analysis.aiDetection.isAIGenerated ? 'AI-Generated' : 'Human-Created'} ${analysis.content.category}`,
      description: analysis.content.description,
      image: imageUrl,
      imageHash,
      mediaUrl: imageUrl,
      mediaHash: imageHash,
      mediaType: "image/jpeg",
      creators: [{
        name: "Creator",
        address: userAddress,
        contributionPercent: 100,
      }],
      tags: analysis.content.tags,
      ipType: analysis.content.type,
      
      // AI-specific metadata
      aiMetadata: analysis.aiDetection.isAIGenerated ? {
        isAIGenerated: true,
        confidence: analysis.aiDetection.confidence,
        aiModel: analysis.aiDetection.aiModel,
        indicators: analysis.aiDetection.indicators,
        analysisDate: new Date().toISOString(),
        learningRestriction: analysis.aiDetection.learningRestriction
      } : undefined,
      
      // Robot terms for AI training control
      robotTerms: analysis.licenseRecommendation.robotTerms,
      
      // Enhanced metadata
      qualityMetrics: analysis.qualityAssessment,
      ipAssessment: analysis.ipEligibility,
      licenseGuidance: analysis.licenseRecommendation,
      
      // Compliance info
      compliance: {
        analysisDate: new Date().toISOString(),
        analysisVersion: "3.0-AI-Control",
        eligibilityScore: analysis.ipEligibility.score,
        recommendedLicense: analysis.licenseRecommendation.primary,
        aiTrainingRestricted: analysis.licenseRecommendation.suggestedTerms.aiTrainingRestricted
      }
    };

    const nftMetadata = {
      name: `${analysis.content.type} IP Asset ${analysis.aiDetection.isAIGenerated ? '(AI-Generated)' : '(Human-Created)'}`,
      description: `${analysis.aiDetection.isAIGenerated ? 'AI-Generated' : 'Human-Created'} IP Asset: ${analysis.content.description}`,
      image: imageUrl,
      attributes: [
        { trait_type: "Content Type", value: analysis.content.type },
        { trait_type: "Creation Method", value: analysis.aiDetection.isAIGenerated ? "AI-Generated" : "Human-Created" },
        { trait_type: "AI Confidence", value: Math.round(analysis.aiDetection.confidence * 100) },
        { trait_type: "Quality Score", value: analysis.qualityAssessment.overall },
        { trait_type: "Originality", value: analysis.qualityAssessment.artistic.originality },
        { trait_type: "IP Eligible", value: analysis.ipEligibility.isEligible ? "Yes" : "No" },
        { trait_type: "IP Score", value: analysis.ipEligibility.score },
        { trait_type: "Market Value", value: analysis.content.marketValue },
        { trait_type: "Recommended License", value: analysis.licenseRecommendation.primary },
        { trait_type: "AI Training Restricted", value: analysis.licenseRecommendation.suggestedTerms.aiTrainingRestricted ? "Yes" : "No" },
        { trait_type: "Learning Restriction", value: analysis.aiDetection.learningRestriction }
      ],
    };

    return { ipMetadata, nftMetadata };
  }

  private async getImageHash(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      return "0x" + createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    } catch (error) {
      console.error("Error hashing image:", error);
      return "0x" + createHash("sha256").update(imageUrl).digest("hex");
    }
  }

  // User-friendly recommendation dengan AI learning control
  getSimpleRecommendationWithAIControl(analysis: AdvancedAnalysisResult): SimpleRecommendation {
    const score = analysis.ipEligibility.score;
    const isAI = analysis.aiDetection.isAIGenerated;
    const aiConfidence = analysis.aiDetection.confidence;
    
    if (isAI && aiConfidence >= 0.85) {
      return {
        status: 'ai-restricted',
        message: '🤖 AI-Generated content detected. AI training automatically disabled.',
        action: 'Register with Commercial Remix (AI training blocked)',
        license: 'Commercial Remix - AI Training Blocked',
        aiLearning: '🚫 Disabled - Protects your AI-generated content'
      };
    } else if (isAI && aiConfidence >= 0.65) {
      return {
        status: 'fair',
        message: '⚠️ Possible AI content. AI training restricted as precaution.',
        action: 'Register with Commercial Remix (AI training restricted)',
        license: 'Commercial Remix - AI Training Restricted',
        aiLearning: '🚫 Restricted - Precautionary protection'
      };
    } else if (score >= 80) {
      return {
        status: 'excellent',
        message: '🌟 Excellent human-created content! Full commercial potential.',
        action: 'Register with Commercial Remix - you choose AI training',
        license: 'Commercial Remix - Premium terms',
        aiLearning: '✅ Your choice - Human-created content'
      };
    } else if (score >= 65) {
      return {
        status: 'good',
        message: '✅ Good quality human content suitable for commercial use.',
        action: 'Register with Commercial Remix (standard terms)',
        license: 'Commercial Remix - Standard terms',
        aiLearning: '✅ Your choice - Human-created content'
      };
    } else {
      return {
        status: 'poor',
        message: '❌ Content needs improvement for IP registration.',
        action: 'Share non-commercially or improve quality',
        license: 'Non-Commercial - Attribution only',
        aiLearning: '✅ Your choice - Human-created content'
      };
    }
  }
}
