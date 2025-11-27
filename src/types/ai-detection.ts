export interface AdvancedAnalysisResult {
  // Deteksi AI
  aiDetection: {
    isAIGenerated: boolean;
    confidence: number;
    indicators: string[];
    aiModel?: string;
    learningRestriction: 'disabled' | 'enabled' | 'conditional';
  };

  // Penilaian Kualitas
  qualityAssessment: {
    overall: number;
    technical: {
      resolution: number;
      sharpness: number;
      composition: number;
      lighting: number;
      colorBalance: number;
    };
    artistic: {
      creativity: number;
      originality: number;
      aesthetics: number;
      concept: number;
    };
  };

  // Kelayakan IP
  ipEligibility: {
    isEligible: boolean;
    score: number;
    reasons: string[];
    risks: string[];
    requirements: string[];
  };

  // Rekomendasi Lisensi dengan AI Learning Control
  licenseRecommendation: {
    primary: 'commercial' | 'nonCommercial' | 'remix';
    confidence: number;
    reasoning: string;
    aiLearningAllowed: boolean;
    robotTerms: {
      userAgent: string;
      allow: string;
    };
    suggestedTerms: {
      mintingFee: number;
      commercialRevShare: number;
      derivativesAllowed: boolean;
      commercialUse: boolean;
      aiTrainingRestricted: boolean;
    };
  };

  // Content metadata
  content: {
    type: string;
    category: string;
    description: string;
    tags: string[];
    marketValue: 'low' | 'medium' | 'high' | 'premium';
    // Policy-relevant flags
    containsHumanFace?: boolean;
    faceCount?: number;
    famousPersonDetected?: boolean;
    famousBrandOrCharacterDetected?: boolean;
  };
}

export interface SimpleRecommendation {
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'ai-restricted';
  message: string;
  action: string;
  license: string;
  aiLearning: string;
}

export interface AIMetadata {
  ipMetadata: {
    title: string;
    description: string;
    image: string;
    imageHash: string;
    mediaUrl: string;
    mediaHash: string;
    mediaType: string;
    creators: Array<{
      name: string;
      address: string;
      contributionPercent: number;
    }>;
    tags: string[];
    ipType: string;
    aiMetadata?: {
      isAIGenerated: boolean;
      confidence: number;
      aiModel?: string;
      indicators: string[];
      analysisDate: string;
      learningRestriction: string;
    };
    robotTerms: {
      userAgent: string;
      allow: string;
    };
    qualityMetrics: AdvancedAnalysisResult['qualityAssessment'];
    ipAssessment: AdvancedAnalysisResult['ipEligibility'];
    licenseGuidance: AdvancedAnalysisResult['licenseRecommendation'];
    compliance: {
      analysisDate: string;
      analysisVersion: string;
      eligibilityScore: number;
      recommendedLicense: string;
      aiTrainingRestricted: boolean;
    };
  };
  nftMetadata: {
    name: string;
    description: string;
    image: string;
    attributes: Array<{
      trait_type: string;
      value: string | number | boolean;
    }>;
  };
}
