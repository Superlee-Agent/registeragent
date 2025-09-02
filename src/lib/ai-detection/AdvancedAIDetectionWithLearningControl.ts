import OpenAI from 'openai';
import { createHash } from 'crypto';
import { AdvancedAnalysisResult, SimpleRecommendation, AIMetadata } from '@/types/ai-detection';
import { getChatModel } from '@/lib/openai';
import { ConsoleLogger, Logger } from './logger';
import { safeParseJson, unifiedSchema, entitiesSchema, captionSchema, supermanSchema, famousSchema } from './schemas';
import { AI_CONFIG } from './config';

export class AdvancedAIDetectionWithLearningControl {
  private openai: OpenAI;
  private logger: Logger;

  constructor(client?: OpenAI, logger?: Logger) {
    this.openai = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.logger = logger ?? new ConsoleLogger('AdvancedAIDetection');
  }

  async analyzeImage(imageUrl: string): Promise<AdvancedAnalysisResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: getChatModel(),
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
    "famousBrandOrCharacterDetected": boolean,
    "detectedCelebrities": ["celebrity names if any"],
    "detectedBrands": ["brand names if any"],
    "detectedCharacters": ["fictional character names if any (e.g., Superman, Mickey Mouse)"],
    "logoPresent": boolean
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
                image_url: { url: imageUrl, detail: 'low' }
              }
            ]
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      // Second pass: explicit entity detection (celebrities/brands/characters)
      try {
        const entsP = this.detectEntities(imageUrl);
        const capP = this.detectCaptionEntities(imageUrl);
        const supP = this.checkSuperman(imageUrl);
        const famP = this.checkFamousCharacter(imageUrl);
        const [entsRes, capRes, supRes, famRes] = await Promise.allSettled([entsP, capP, supP, famP]);

        const ents = entsRes.status === 'fulfilled' && entsRes.value ? entsRes.value : { celebrities: [], brands: [], characters: [], logoPresent: false };
        analysis.content = analysis.content || {};
        analysis.content.detectedCelebrities = Array.isArray(analysis.content.detectedCelebrities) ? analysis.content.detectedCelebrities : [];
        analysis.content.detectedBrands = Array.isArray(analysis.content.detectedBrands) ? analysis.content.detectedBrands : [];
        analysis.content.detectedCharacters = Array.isArray(analysis.content.detectedCharacters) ? analysis.content.detectedCharacters : [];
        analysis.content.logoPresent = Boolean(analysis.content.logoPresent);
        analysis.content.detectedCelebrities = Array.from(new Set([...(analysis.content.detectedCelebrities), ...ents.celebrities]));
        analysis.content.detectedBrands = Array.from(new Set([...(analysis.content.detectedBrands), ...ents.brands]));
        analysis.content.detectedCharacters = Array.from(new Set([...(analysis.content.detectedCharacters), ...ents.characters]));
        if (typeof ents.logoPresent === 'boolean') analysis.content.logoPresent = analysis.content.logoPresent || ents.logoPresent;
        if (!analysis.content.famousPersonDetected && analysis.content.detectedCelebrities.length > 0) analysis.content.famousPersonDetected = true;
        if (!analysis.content.famousBrandOrCharacterDetected && ((analysis.content.detectedBrands?.length||0) > 0 || (analysis.content.detectedCharacters?.length||0) > 0 || analysis.content.logoPresent)) analysis.content.famousBrandOrCharacterDetected = true;

        const cap = capRes.status === 'fulfilled' ? capRes.value : null;
        if (cap) {
          const capText = `${cap.caption || ''} ${(cap.entities || []).join(' ')}`.toLowerCase();
          if (!analysis.content.famousPersonDetected && AI_CONFIG.celebrities.some(n => capText.includes(n))) analysis.content.famousPersonDetected = true;
          if (!analysis.content.famousBrandOrCharacterDetected && AI_CONFIG.brandsOrCharacters.some(n => capText.includes(n))) analysis.content.famousBrandOrCharacterDetected = true;
          const norm = (arr?: string[]) => (Array.isArray(arr) ? arr : []).map(s => String(s)).filter(Boolean);
          analysis.content.detectedCelebrities = Array.from(new Set([...(analysis.content.detectedCelebrities||[]), ...norm(cap.entities).filter(e => AI_CONFIG.celebrities.some(h => e.toLowerCase().includes(h)))]));
          analysis.content.detectedCharacters = Array.from(new Set([...(analysis.content.detectedCharacters||[]), ...norm(cap.entities).filter(e => AI_CONFIG.brandsOrCharacters.some(h => e.toLowerCase().includes(h)))]));
        }

        if (!analysis.content.famousBrandOrCharacterDetected) {
          const sup = supRes.status === 'fulfilled' ? supRes.value : null;
          if (sup?.superman === true) {
            analysis.content.famousBrandOrCharacterDetected = true;
            analysis.content.detectedCharacters = Array.from(new Set([...(analysis.content.detectedCharacters||[]), 'Superman']));
          }
        }

        if (!analysis.content.famousBrandOrCharacterDetected) {
          const famous = famRes.status === 'fulfilled' ? famRes.value : null;
          if (famous) {
            const names = Array.isArray(famous.names) ? famous.names : [];
            const shouldBlock = Boolean(famous.block) || names.length > 0;
            if (shouldBlock) {
              analysis.content.famousBrandOrCharacterDetected = true;
              if (names.length) {
                analysis.content.detectedCharacters = Array.from(new Set([...(analysis.content.detectedCharacters||[]), ...names]));
              }
            }
          }
        }
      } catch (e) { this.logger?.warn('Entity/caption/famous checks failed', e); }

      // Enhance analysis with business logic
      let enhancedAnalysis = this.enhanceAnalysisWithAIControls(analysis);

      // Unified validator prompt mapping
      try {
        const v = await this.validateWithUnifiedPrompt(imageUrl);
        if (v) {
          const origin = String(v.origin || '').toLowerCase();
          const content = String(v.content || '').toLowerCase();
          const decision = String(v.decision || '').toLowerCase();
          const ai_training = String(v.ai_training || '').toLowerCase();

          // Origin -> AI flag
          const isAI = origin === 'ai';
          enhancedAnalysis.aiDetection.isAIGenerated = isAI;
          // Normalize confidence to match unified origin to avoid contradictory UI
          const prevConf = Number(enhancedAnalysis.aiDetection.confidence || 0);
          enhancedAnalysis.aiDetection.confidence = isAI ? Math.max(AI_CONFIG.confidenceThresholds.HIGH_CONFIDENCE, prevConf) : 0;

          enhancedAnalysis.licenseRecommendation.aiLearningAllowed = !isAI;
          enhancedAnalysis.licenseRecommendation.suggestedTerms.aiTrainingRestricted = isAI || ai_training === 'not allowed';
          enhancedAnalysis.aiDetection.learningRestriction = isAI ? 'disabled' : 'enabled';

          // Content flags
          enhancedAnalysis.content.containsHumanFace = content.includes('human_face');
          enhancedAnalysis.content.famousPersonDetected = content === 'human_face_famous';
          enhancedAnalysis.content.famousBrandOrCharacterDetected = content === 'brand_or_character';

          // Eligibility and requirements
          if (decision.includes('block') || enhancedAnalysis.content.famousBrandOrCharacterDetected || enhancedAnalysis.content.famousPersonDetected) {
            enhancedAnalysis.ipEligibility.isEligible = false;
            if (!enhancedAnalysis.ipEligibility.reasons) enhancedAnalysis.ipEligibility.reasons = [];
            if (decision.includes('block') && !enhancedAnalysis.ipEligibility.reasons.some(r => String(r).toLowerCase().includes('policy decision'))) {
              enhancedAnalysis.ipEligibility.reasons.push('Policy decision: Block');
            }
            if (enhancedAnalysis.content.famousBrandOrCharacterDetected && !enhancedAnalysis.ipEligibility.reasons.includes('Contains famous brand/character')) {
              enhancedAnalysis.ipEligibility.reasons.push('Contains famous brand/character');
            }
            if (enhancedAnalysis.content.famousPersonDetected && !enhancedAnalysis.ipEligibility.reasons.includes('Contains celebrity face')) {
              enhancedAnalysis.ipEligibility.reasons.push('Contains celebrity face');
            }
          } else {
            enhancedAnalysis.ipEligibility.isEligible = true;
          }
          if (decision.includes('selfie')) {
            if (!enhancedAnalysis.ipEligibility.requirements.includes('Selfie verification required')) {
              enhancedAnalysis.ipEligibility.requirements.push('Selfie verification required');
            }
            enhancedAnalysis.content.containsHumanFace = true;
            enhancedAnalysis.content.famousPersonDetected = false;
          }

          // License primary and terms
          enhancedAnalysis.licenseRecommendation.primary = 'remix';
          enhancedAnalysis.licenseRecommendation.suggestedTerms.derivativesAllowed = true;
          enhancedAnalysis.licenseRecommendation.suggestedTerms.commercialUse = true;
        }
      } catch (e) { this.logger?.warn('Unified validator mapping failed', e); }

      this.logger?.info('Advanced AI Analysis with Learning Control complete');
      return enhancedAnalysis;
    } catch (error) {
      this.logger?.error('Error analyzing image', error);
      throw error;
    }
  }

  private async validateWithUnifiedPrompt(imageUrl: string): Promise<{ origin: string; content: string; decision: string; ai_training: string } | null> {
    try {
      const prompt = `You are an IP registration validator. Analyze the attached image and answer in strict JSON format only. Do not explain. Follow the rules strictly:\n\n1. Detect if the image is AI-generated or human-made. Answer only "AI" or "Human".\n2. Detect if the image contains:\n   - a famous person’s face\n   - a brand logo or trademark\n   - a famous/popular fictional character (cartoon, anime, movie, etc.)\n   - a human face (not famous)\n   - no human face at all\n3. Decide if the image can be registered as IP:\n   - If AI-generated with no human face and no famous brand/character → "smart license (commercial remix)"\n   - If AI-generated with a non-famous human face → "smart license (commercial remix, selfie verification required)"\n   - If AI-generated with famous face/brand/character → "block"\n   - If Human-made with no human face and no famous brand/character → "smart license (commercial remix)"\n   - If Human-made with a non-famous human face → "smart license (commercial remix, selfie verification required)"\n   - If Human-made with famous face/brand/character → "block"\n4. AI training rules:\n   - All AI-generated images → "ai_training": "not allowed"\n   - Human-made images with no human face → "ai_training": "manual (user decides)"\n   - Human-made images with a non-famous human face → "ai_training": "manual (user decides)"\n\nReturn output ONLY in JSON like this:\n{\n  "origin": "AI/Human",\n  "content": "no_face / human_face_non_famous / human_face_famous / brand_or_character",\n  "decision": "smart license (commercial remix)" OR "smart license (commercial remix, selfie verification required)" OR "block",\n  "ai_training": "not allowed" OR "manual (user decides)"\n}`;
      const resp = await this.openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          { role: "user", content: [ { type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl, detail: 'low' } } ] }
        ],

        temperature: 0,
        response_format: { type: "json_object" }
      });
      const raw = resp.choices[0]?.message?.content || '{}';
      return safeParseJson(raw, unifiedSchema, null as any);
    } catch (e) {
      this.logger?.warn('Unified prompt failed', e);
      return null;
    }
  }

  private async detectEntities(imageUrl: string): Promise<{ celebrities: string[]; brands: string[]; characters: string[]; logoPresent: boolean; }> {
    try {
      const resp = await this.openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Identify any well-known public figures, brands/logos, and fictional characters in this image.
Return STRICT JSON with keys: celebrities (string[]), brands (string[]), characters (string[]), logoPresent (boolean).
Be conservative: if it resembles iconic characters (e.g., Superman blue suit + red cape + 'S' emblem; Batman cowl + bat emblem; Spider-Man red/blue web suit), include them in characters.
If none, use [] and false. Respond ONLY JSON.` },
              { type: "image_url", image_url: { url: imageUrl, detail: 'low' } }
            ]
          }
        ],

        temperature: 0,
        response_format: { type: "json_object" }
      });
      const raw = resp.choices[0]?.message?.content || '{}';
      return safeParseJson(raw, entitiesSchema, { celebrities: [], brands: [], characters: [], logoPresent: false });
    } catch (e) {
      this.logger?.warn('Entity detection failed', e);
      return { celebrities: [], brands: [], characters: [], logoPresent: false };
    }
  }

  private async detectCaptionEntities(imageUrl: string): Promise<{ entities: string[]; caption: string } | null> {
    try {
      const resp = await this.openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `What is this image? Provide a short caption and list any named entities (people, brands/logos, or fictional characters) you recognize. Return STRICT JSON: {"caption": string, "entities": string[]}. Only JSON.` },
              { type: "image_url", image_url: { url: imageUrl, detail: 'low' } }
            ]
          }
        ],

        temperature: 0,
        response_format: { type: "json_object" }
      });
      const raw = resp.choices[0]?.message?.content || '{}';
      return safeParseJson(raw, captionSchema, null as any);
    } catch (e) {
      this.logger?.warn('Caption detection failed', e);
      return null;
    }
  }

  private async checkSuperman(imageUrl: string): Promise<{ superman: boolean } | null> {
    try {
      const resp = await this.openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Does this image depict Superman or a Superman-like character? Consider cues: blue suit, red cape, large yellow 'S' chest emblem, DC Comics style. Respond STRICT JSON: {"superman": true|false}. Only JSON.` },
              { type: "image_url", image_url: { url: imageUrl, detail: 'low' } }
            ]
          }
        ],
        temperature: 0.0,
        response_format: { type: "json_object" }
      });
      const raw = resp.choices[0]?.message?.content || '{}';
      return safeParseJson(raw, supermanSchema, null as any);
    } catch (e) {
      this.logger?.warn('Superman check failed', e);
      return null;
    }
  }

  private async checkFamousCharacter(imageUrl: string): Promise<{ names: string[]; block: boolean } | null> {
    try {
      const resp = await this.openai.chat.completions.create({
        model: getChatModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Does this image depict any well-known fictional characters or branded mascots (e.g., Superman, Batman, Spider-Man, Mickey Mouse), or recognizable brand logo elements? Return STRICT JSON: {"names": string[], "block": boolean}. Set block=true if yes. Only JSON.` },
              { type: "image_url", image_url: { url: imageUrl, detail: 'low' } }
            ]
          }
        ],
        temperature: 0.0,
        response_format: { type: "json_object" }
      });
      const raw = resp.choices[0]?.message?.content || '{}';
      return safeParseJson(raw, famousSchema, null as any);
    } catch (e) {
      this.logger?.warn('Famous character check failed', e);
      return null;
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
    enhanced.content.detectedCelebrities = Array.isArray(enhanced.content.detectedCelebrities) ? enhanced.content.detectedCelebrities : [];
    enhanced.content.detectedBrands = Array.isArray(enhanced.content.detectedBrands) ? enhanced.content.detectedBrands : [];
    enhanced.content.detectedCharacters = Array.isArray(enhanced.content.detectedCharacters) ? enhanced.content.detectedCharacters : [];
    enhanced.content.logoPresent = Boolean(enhanced.content.logoPresent);
    enhanced.licenseRecommendation = enhanced.licenseRecommendation || { suggestedTerms: {} };
    enhanced.licenseRecommendation.suggestedTerms = enhanced.licenseRecommendation.suggestedTerms || {};
    enhanced.ipEligibility = enhanced.ipEligibility || { score: 0, reasons: [], risks: [], requirements: [] };

    // Promote flags based on explicit detections
    if (!enhanced.content.famousPersonDetected && enhanced.content.detectedCelebrities.length > 0) {
      enhanced.content.famousPersonDetected = true;
      enhanced.content.tags = Array.from(new Set([...(enhanced.content.tags||[]), ...enhanced.content.detectedCelebrities]));
    }
    if (!enhanced.content.famousBrandOrCharacterDetected && (enhanced.content.detectedBrands.length > 0 || enhanced.content.detectedCharacters.length > 0 || enhanced.content.logoPresent)) {
      enhanced.content.famousBrandOrCharacterDetected = true;
      enhanced.content.tags = Array.from(new Set([...(enhanced.content.tags||[]), ...enhanced.content.detectedBrands, ...enhanced.content.detectedCharacters, enhanced.content.logoPresent ? 'Logo' : undefined].filter(Boolean)));
    }

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

    // Low-confidence adjustment: keep AI flag, adjust confidence and note
    if (enhanced.aiDetection.isAIGenerated && (conf < AI_CONFIG.confidenceThresholds.MEDIUM_CONFIDENCE || enhanced.aiDetection.indicators.length === 0)) {
      enhanced.aiDetection.confidence = Math.max(conf, AI_CONFIG.confidenceThresholds.LOW_MIN_CONFIDENCE);
      if (!enhanced.aiDetection.indicators.includes('Low confidence adjustment')) {
        enhanced.aiDetection.indicators.push('Low confidence adjustment');
      }
      enhanced.content.tags = Array.from(new Set([...(enhanced.content.tags||[]), 'Low-Confidence-Adjustment']));
    }

    if (enhanced.aiDetection.isAIGenerated && conf >= AI_CONFIG.confidenceThresholds.HIGH_CONFIDENCE) {
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

      enhanced.ipEligibility.score = Math.max(0, (enhanced.ipEligibility.score || 0) - AI_CONFIG.eligibility.AI_SCORE_PENALTY_HIGH);
      enhanced.ipEligibility.risks.push('AI-generated content has limited IP protection');
      enhanced.ipEligibility.requirements.push('Verify human creative input and authorship');

    } else if (enhanced.aiDetection.isAIGenerated && conf >= AI_CONFIG.confidenceThresholds.MEDIUM_CONFIDENCE) {
      // Medium confidence AI-generated
      enhanced.aiDetection.learningRestriction = 'conditional';
      enhanced.licenseRecommendation.aiLearningAllowed = false;
      enhanced.licenseRecommendation.suggestedTerms.aiTrainingRestricted = true;

      enhanced.licenseRecommendation.robotTerms = {
        userAgent: 'AI-Crawlers',
        allow: 'Disallow: / # Conditional AI training restriction'
      };

    } else {
      if (enhanced.aiDetection.isAIGenerated) {
        // Low confidence AI-generated: treat as conditional
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
    }

    // Apply policy flags: brand/celebrity/character block and selfie requirement
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

  // Classify image using fixed answer set prompt and map to analysis
  public async classifyWithPresetAnswers(imageUrl: string): Promise<{ id: number; text: string }> {
    const prompt = `What is this? Answer with only one of the following options:

Answer 1:
This is an AI-generated image.
No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommended

Commercial Remix License (minting fee & revenue share set manually).
– AI training not allowed (fixed, cannot be changed manually).

Answer 2:
This is an AI-generated image.
Contains brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to Submit Review.

Answer 3:
This is an AI-generated image.
Contains an ordinary human face (not famous).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training not allowed.
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).

Answer 4:
This is a human-made image.
No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommends "Commercial Remix" License (minting fee & revenue share set manually).
– AI training allowed (user can set manually).

Answer 5:
This is a human-made image.
Contains brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to "Submit Review".

Answer 6:
This is a human-made image.
Contains an ordinary human face (not a celebrity or famous character).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training allowed (user can set manually).
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).

Answer 7:
This is an AI-generated image.
This is an animation. No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommended

Commercial Remix License (minting fee & revenue share set manually).
– AI training not allowed (fixed, cannot be changed manually).

Answer 8:
This is an AI-generated image.
This is an animation containing brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to Submit Review.

Answer 9:
This is an AI-generated image.
This is an animation containing an ordinary human face (not famous).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training allowed (user can set manually).
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).

Answer 10:
This is a human-made image.
This is an animation. No human face, no brand/famous character.
✅ This IP can be registered.
– Smart Licensing: recommends "Commercial Remix" License (minting fee & revenue share set manually).
– AI training allowed (user can set manually).

Answer 11:
This is a human-made image.
This is an animation containing brand/famous character or famous human face.
❌ Registration of this IP is not allowed.
– User only has the option to "Submit Review".

Answer 12:
This is a human-made image.
This is an animation containing an ordinary human face (not a celebrity or famous character).
❌ Registration of this IP is not directly allowed.
– User can choose "Take Selfie Photo".
– If selfie verification succeeds → ✅ This IP can be registered (Smart Licensing recommends "Commercial Remix" License, minting fee & revenue share set manually).
– AI training allowed (user can set manually).
– If selfie verification fails → ❌ IP registration is rejected (Submit Review option).

Instructions:
- Choose exactly one Answer from the list (1-12) that best fits the image.
- Respond ONLY in strict JSON with keys exactly: {"answer_id": <1-12>, "answer_text": "<paste the exact text of the chosen Answer block>"}. No markdown, no extra keys, no prose.`;

    const resp = await this.openai.chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "user", content: [ { type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl, detail: 'low' } } ] as any }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    }, { timeout: 10000 });
    const raw = resp.choices[0]?.message?.content || '{}';

    console.log('🤖 Model raw response:', raw.slice(0, 200) + '...');
    let j: any = {};
    try { j = JSON.parse(raw); } catch { throw new Error('Invalid JSON from model'); }
    console.log('📋 Parsed JSON:', { answer_id: j.answer_id, answer_text_length: String(j.answer_text || '').length });
    const id = Number(j.answer_id);
    const text = String(j.answer_text || '').trim();
    console.log('🔢 Final extraction:', { id, textLength: text.length, textPreview: text.slice(0, 100) + '...' });
    if (!Number.isFinite(id) || id < 1 || id > 12 || !text) {
      throw new Error("Unable to classify answer 1-12");
    }
    return { id, text };
  }

  private buildAnalysisFromClassification(imageUrl: string, cls: { id: number; text: string }): AdvancedAnalysisResult {
    const id = cls.id;
    const isAI = [1,2,3,7,8,9].includes(id);
    const isAnimation = [7,8,9,10,11,12].includes(id);
    const hasFamous = [2,5,8,11].includes(id);
    const hasOrdinaryFace = [3,6,9,12].includes(id);
    const noFace = [1,4,7,10].includes(id);

    const containsHumanFace = hasOrdinaryFace || [2,5,8,11].includes(id);
    const famousPersonDetected = [2,5,8,11].includes(id);
    const famousBrandOrCharacterDetected = [2,5,8,11].includes(id);

    const canRegisterNow = [1,4,7,10].includes(id);
    const requiresSelfie = [3,6,9,12].includes(id);
    const blocked = [2,5,8,11].includes(id);

    const aiTrainingAllowed = ((): boolean => {
      if (isAI) {
        if ([1,3,7].includes(id)) return false;
        if (id === 9) return true;
        return false;
      }
      return true;
    })();

    const overall = isAI ? 6 : 7;

    const analysis: AdvancedAnalysisResult = {
      aiDetection: {
        isAIGenerated: isAI,
        confidence: 0.9,
        indicators: isAI ? ["Policy-based classification"] : ["Policy-based classification"],
        aiModel: undefined,
        learningRestriction: isAI ? (aiTrainingAllowed ? 'conditional' : 'disabled') : 'enabled',
      },
      qualityAssessment: {
        overall,
        technical: { resolution: overall, sharpness: overall, composition: overall, lighting: overall, colorBalance: overall },
        artistic: { creativity: overall, originality: overall, aesthetics: overall, concept: overall },
      },
      ipEligibility: {
        isEligible: canRegisterNow && !blocked,
        score: canRegisterNow && !blocked ? 85 : (requiresSelfie ? 50 : 15),
        reasons: blocked ? [famousPersonDetected ? 'Contains celebrity face' : 'Contains famous brand/character'] : (requiresSelfie ? ['Selfie verification required'] : ['Meets policy requirements']),
        risks: blocked ? ['High legal risk: trademark/publicity rights'] : [],
        requirements: requiresSelfie ? ['Selfie verification required'] : [],
      },
      licenseRecommendation: {
        primary: 'remix',
        confidence: 0.9,
        reasoning: canRegisterNow ? 'Eligible per preset policy classification' : (blocked ? 'Blocked per policy (famous brand/character or celebrity)' : 'Requires selfie verification'),
        aiLearningAllowed: aiTrainingAllowed,
        robotTerms: aiTrainingAllowed ? { userAgent: '*', allow: 'Allow: /' } : { userAgent: '*', allow: 'Disallow: /' },
        suggestedTerms: {
          mintingFee: 50,
          commercialRevShare: 10,
          derivativesAllowed: true,
          commercialUse: true,
          aiTrainingRestricted: !aiTrainingAllowed,
        },
      },
      content: {
        type: isAnimation ? 'animation' : 'image',
        category: isAnimation ? 'animation' : 'digital content',
        description: `Preset classification Answer ${id}`,
        tags: Array.from(new Set([
          isAI ? 'AI-Generated' : 'Human-Created',
          isAnimation ? 'Animation' : undefined,
          containsHumanFace ? 'Human-Face' : 'No-Face',
          famousPersonDetected ? 'Celebrity' : undefined,
          famousBrandOrCharacterDetected ? 'Brand/Character' : undefined,
        ].filter(Boolean) as string[])),
        marketValue: 'medium',
        containsHumanFace,
        faceCount: containsHumanFace ? 1 : 0,
        famousPersonDetected,
        famousBrandOrCharacterDetected,
      },
    };

    return analysis;
  }

  public async analyzeImagePreset(imageUrl: string): Promise<{ analysis: AdvancedAnalysisResult; classification: { id: number; text: string } }> {
    console.log('🎯 Starting preset classification...');
    const cls = await this.classifyWithPresetAnswers(imageUrl);
    console.log('✅ Classification result:', { id: cls.id, textLength: cls.text.length });
    const analysis = this.buildAnalysisFromClassification(imageUrl, cls);
    console.log('📊 Built analysis from classification');
    return { analysis, classification: cls };
  }

  private calculateEnhancedIPEligibility(analysis: any): any {
    let score = 0;
    const reasons = [];
    const risks = [];
    const requirements = [];

    // Quality factors (35% weight)
    const qualityScore = analysis.qualityAssessment?.overall || 0;
    score += qualityScore * AI_CONFIG.scoringWeights.QUALITY_WEIGHT;

    // Originality factors (25% weight)
    const originalityScore = analysis.qualityAssessment?.artistic?.originality || 0;
    score += originalityScore * AI_CONFIG.scoringWeights.ORIGINALITY_WEIGHT;

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
    let isEligible = finalScore >= AI_CONFIG.eligibility.MIN_SCORE;

    // Enforce blocking policy for celebrities/brands/characters regardless of score
    const blocked = !!(analysis.content?.famousBrandOrCharacterDetected || analysis.content?.famousPersonDetected);
    if (blocked) {
      isEligible = false;
      if (analysis.content?.famousBrandOrCharacterDetected && !reasons.includes('Contains famous brand/character')) reasons.push('Contains famous brand/character');
      if (analysis.content?.famousPersonDetected && !reasons.includes('Contains celebrity face')) reasons.push('Contains celebrity face');
      if (!risks.includes('High legal risk: trademark/publicity rights')) risks.push('High legal risk: trademark/publicity rights');
    }

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

    if (isAI && aiConfidence >= AI_CONFIG.confidenceThresholds.HIGH_CONFIDENCE) {
      primary = 'remix';
      reasoning = 'AI-generated content with high confidence. Recommended Commercial Remix with AI training disabled to protect rights.';
      mintingFee = 0;
      commercialRevShare = 0;
      aiTrainingRestricted = true;
      
    } else if (isAI && aiConfidence >= AI_CONFIG.confidenceThresholds.MEDIUM_CONFIDENCE) {
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
    
    if (isAI && aiConfidence >= AI_CONFIG.confidenceThresholds.HIGH_CONFIDENCE) {
      return {
        status: 'ai-restricted',
        message: '🤖 AI-Generated content detected. AI training automatically disabled.',
        action: 'Register with Commercial Remix (AI training blocked)',
        license: 'Commercial Remix - AI Training Blocked',
        aiLearning: '🚫 Disabled - Protects your AI-generated content'
      };
    } else if (isAI && aiConfidence >= AI_CONFIG.confidenceThresholds.MEDIUM_CONFIDENCE) {
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
