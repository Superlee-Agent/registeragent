"use client";

import { useState, useCallback } from 'react';
import { AdvancedAnalysisResult, SimpleRecommendation, AIMetadata } from '@/types/ai-detection';

interface UseAdvancedAIDetectionReturn {
  analysis: AdvancedAnalysisResult | null;
  recommendation: SimpleRecommendation | null;
  metadata: AIMetadata | null;
  isAnalyzing: boolean;
  error: string | null;
  analyzeImage: (imageUrl: string, userAddress?: string) => Promise<void>;
  analyzeImageFromBase64: (imageBase64: string, userAddress?: string) => Promise<void>;
  reset: () => void;
}

export function useAdvancedAIDetection(): UseAdvancedAIDetectionReturn {
  const controllerRef = (typeof window !== 'undefined') ? (window as any).__aiCtrlRef ?? ((window as any).__aiCtrlRef = { current: null as AbortController | null }) : { current: null as AbortController | null };
  const [analysis, setAnalysis] = useState<AdvancedAnalysisResult | null>(null);
  const [recommendation, setRecommendation] = useState<SimpleRecommendation | null>(null);
  const [metadata, setMetadata] = useState<AIMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeImage = useCallback(async (imageUrl: string, userAddress?: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setRecommendation(null);
    setMetadata(null);

    try {
      const response = await fetch('/api/ai/analyze-advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          userAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.analysis);
      setRecommendation(data.recommendation);
      setMetadata(data.metadata);

    } catch (err) {
      console.error('Advanced AI detection error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const analyzeImageFromBase64 = useCallback(async (imageBase64: string, userAddress?: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setRecommendation(null);
    setMetadata(null);

    try {
      const response = await fetch('/api/ai/analyze-advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          userAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.analysis);
      setRecommendation(data.recommendation);
      setMetadata(data.metadata);

    } catch (err) {
      console.error('Advanced AI detection error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnalysis(null);
    setRecommendation(null);
    setMetadata(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  return {
    analysis,
    recommendation,
    metadata,
    isAnalyzing,
    error,
    analyzeImage,
    analyzeImageFromBase64,
    reset,
  };
}

// Legacy compatibility hook for basic AI detection
export function useBasicAIDetection() {
  const [result, setResult] = useState<{ isAI: boolean; confidence: number; status?: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeImage = useCallback(async (imageUrl: string) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/detect-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'AI detection failed');
      }

      // Convert advanced result to basic format for compatibility
      const basicResult = {
        isAI: data.analysis.aiDetection.isAIGenerated,
        confidence: data.analysis.aiDetection.confidence,
        status: 'completed' as const,
      };

      setResult(basicResult);

    } catch (err) {
      console.error('Basic AI detection error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResult({ isAI: false, confidence: 0, status: 'failed' });
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    result,
    isAnalyzing,
    error,
    analyzeImage,
    reset: () => {
      setResult(null);
      setError(null);
      setIsAnalyzing(false);
    },
  };
}
