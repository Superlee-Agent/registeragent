export interface AIDetectionConfig {
  confidenceThresholds: {
    HIGH_CONFIDENCE: number;
    MEDIUM_CONFIDENCE: number;
    LOW_MIN_CONFIDENCE: number;
  };
  scoringWeights: {
    QUALITY_WEIGHT: number;
    ORIGINALITY_WEIGHT: number;
  };
  eligibility: {
    MIN_SCORE: number;
    AI_SCORE_PENALTY_HIGH: number;
  };
  celebrities: string[];
  brandsOrCharacters: string[];
}

function num(env: string | undefined, d: number) {
  const n = Number(env);
  return Number.isFinite(n) ? n : d;
}

export const AI_CONFIG: AIDetectionConfig = {
  confidenceThresholds: {
    HIGH_CONFIDENCE: num(process.env.AI_CONF_HIGH, 0.85),
    MEDIUM_CONFIDENCE: num(process.env.AI_CONF_MED, 0.65),
    LOW_MIN_CONFIDENCE: num(process.env.AI_CONF_LOW_MIN, 0.3),
  },
  scoringWeights: {
    QUALITY_WEIGHT: num(process.env.AI_WEIGHT_QUALITY, 3.5),
    ORIGINALITY_WEIGHT: num(process.env.AI_WEIGHT_ORIG, 2.5),
  },
  eligibility: {
    MIN_SCORE: num(process.env.AI_ELIGIBILITY_MIN, 50),
    AI_SCORE_PENALTY_HIGH: num(process.env.AI_PENALTY_HIGH, 20),
  },
  celebrities: (
    process.env.AI_HINT_CELEBS?.split(',').map(s => s.trim()).filter(Boolean) ?? [
      'elon musk','taylor swift','barack obama','beyonce','rihanna','cristiano ronaldo','lionel messi','donald trump','bill gates','mark zuckerberg','selena gomez'
    ]
  ),
  brandsOrCharacters: (
    process.env.AI_HINT_BRANDS?.split(',').map(s => s.trim()).filter(Boolean) ?? [
      'nike','adidas','apple','microsoft','google','coca-cola','mcdonalds','mcdonald\'s','disney','tesla','starbucks','samsung','netflix','amazon',
      'mickey','mickey mouse','minnie','spiderman','spider-man','batman','superman','pikachu','hello kitty','spongebob','doraemon','naruto'
    ]
  ),
};
