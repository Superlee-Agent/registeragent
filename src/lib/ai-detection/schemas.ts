import { z } from 'zod';

export const entitiesSchema = z.object({
  celebrities: z.array(z.string()).default([]),
  brands: z.array(z.string()).default([]),
  characters: z.array(z.string()).default([]),
  logoPresent: z.boolean().default(false),
});

export const captionSchema = z.object({
  caption: z.string().default(''),
  entities: z.array(z.string()).default([]),
});

export const supermanSchema = z.object({ superman: z.boolean().default(false) });

export const famousSchema = z.object({
  names: z.array(z.string()).default([]),
  block: z.boolean().default(false),
});

export const unifiedSchema = z.object({
  origin: z.string().default(''),
  content: z.string().default(''),
  decision: z.string().default(''),
  ai_training: z.string().default(''),
});

export const analysisSchema = z.object({
  aiDetection: z.object({
    isAIGenerated: z.boolean().default(false),
    confidence: z.number().min(0).max(1).default(0),
    indicators: z.array(z.string()).default([]),
    aiModel: z.string().optional(),
    learningRestriction: z.enum(['disabled','enabled','conditional']).optional(),
  }).default({ isAIGenerated: false, confidence: 0, indicators: [] }),
  qualityAssessment: z.object({
    overall: z.number().default(0),
    technical: z.object({
      resolution: z.number().default(0),
      sharpness: z.number().default(0),
      composition: z.number().default(0),
      lighting: z.number().default(0),
      colorBalance: z.number().default(0),
    }).default({ resolution:0, sharpness:0, composition:0, lighting:0, colorBalance:0 }),
    artistic: z.object({
      creativity: z.number().default(0),
      originality: z.number().default(0),
      aesthetics: z.number().default(0),
      concept: z.number().default(0),
    }).default({ creativity:0, originality:0, aesthetics:0, concept:0 }),
  }).default({ overall: 0, technical: { resolution:0, sharpness:0, composition:0, lighting:0, colorBalance:0 }, artistic: { creativity:0, originality:0, aesthetics:0, concept:0 } }),
  ipEligibility: z.object({
    isEligible: z.boolean().default(false),
    score: z.number().default(0),
    reasons: z.array(z.string()).default([]),
    risks: z.array(z.string()).default([]),
    requirements: z.array(z.string()).default([]),
  }).default({ isEligible:false, score:0, reasons:[], risks:[], requirements:[] }),
  licenseRecommendation: z.object({
    primary: z.enum(['commercial','nonCommercial','remix']).default('remix'),
    confidence: z.number().min(0).max(1).default(0.7),
    reasoning: z.string().default(''),
    aiLearningAllowed: z.boolean().default(true),
    robotTerms: z.object({ userAgent: z.string().default('*'), allow: z.string().default('') }).partial().default({}),
    suggestedTerms: z.object({
      mintingFee: z.number().default(0),
      commercialRevShare: z.number().default(0),
      derivativesAllowed: z.boolean().default(true),
      commercialUse: z.boolean().default(true),
      aiTrainingRestricted: z.boolean().default(false),
    }).default({ mintingFee:0, commercialRevShare:0, derivativesAllowed:true, commercialUse:true, aiTrainingRestricted:false }),
  }).default({ primary:'remix', confidence:0.7, reasoning:'', aiLearningAllowed:true, suggestedTerms:{ mintingFee:0, commercialRevShare:0, derivativesAllowed:true, commercialUse:true, aiTrainingRestricted:false } }),
  content: z.object({
    type: z.string().default('image'),
    category: z.string().default('digital content'),
    description: z.string().default(''),
    tags: z.array(z.string()).default([]),
    marketValue: z.enum(['low','medium','high','premium']).or(z.string()).optional(),
    containsHumanFace: z.boolean().default(false),
    faceCount: z.number().default(0),
    famousPersonDetected: z.boolean().default(false),
    famousBrandOrCharacterDetected: z.boolean().default(false),
    detectedCelebrities: z.array(z.string()).default([]),
    detectedBrands: z.array(z.string()).default([]),
    detectedCharacters: z.array(z.string()).default([]),
    logoPresent: z.boolean().default(false),
  }).default({ type:'image', category:'digital content', description:'', tags:[] }),
});

export function safeParseJson<T>(raw: string, schema: z.ZodSchema<T>, fallback: T): T {
  try {
    const j = JSON.parse(raw);
    const r = schema.safeParse(j);
    return r.success ? r.data : fallback;
  } catch {
    return fallback;
  }
}
