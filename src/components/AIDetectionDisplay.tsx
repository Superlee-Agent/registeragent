"use client";

import React from "react";
import { Bot, Eye, AlertTriangle, CheckCircle, Shield, Zap, Star, TrendingUp, Lock, Unlock } from "lucide-react";
import { AdvancedAnalysisResult, SimpleRecommendation } from "@/types/ai-detection";

interface AIDetectionResult {
  isAI: boolean;
  confidence: number;
  status?: 'detecting' | 'completed' | 'failed';
}

interface AIDetectionDisplayProps {
  result?: AIDetectionResult;
  advancedResult?: AdvancedAnalysisResult;
  recommendation?: SimpleRecommendation;
  isAnalyzing?: boolean;
  className?: string;
}

export function AIDetectionDisplay({
  result,
  advancedResult,
  recommendation,
  isAnalyzing = false,
  className = ""
}: AIDetectionDisplayProps) {
  if (!result && !advancedResult && !isAnalyzing) {
    return null;
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-red-400";
    if (confidence >= 0.6) return "text-yellow-400";
    return "text-green-400";
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return "Tinggi";
    if (confidence >= 0.6) return "Sedang";
    return "Rendah";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <Star className="h-4 w-4 text-yellow-400" />;
      case 'good': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'fair': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'ai-restricted': return <Shield className="h-4 w-4 text-red-400" />;
      default: return <Eye className="h-4 w-4 text-blue-400" />;
    }
  };

  if (isAnalyzing) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-full bg-blue-500/20">
            <Bot className="h-5 w-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h3 className="font-medium text-white">Advanced AI Analysis</h3>
            <p className="text-sm text-white/70">Analyzing AI detection, quality, IP eligibility, and license recommendations...</p>
          </div>
        </div>

        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div className="bg-blue-400 h-1.5 rounded-full animate-pulse w-1/2"></div>
        </div>
      </div>
    );
  }

  // Show advanced analysis if available
  if (advancedResult && recommendation) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Quick Recommendation */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${
              recommendation.status === 'excellent' ? 'bg-yellow-500/20' :
              recommendation.status === 'good' ? 'bg-green-500/20' :
              recommendation.status === 'fair' ? 'bg-yellow-500/20' :
              recommendation.status === 'ai-restricted' ? 'bg-red-500/20' : 'bg-gray-500/20'
            }`}>
              {getStatusIcon(recommendation.status)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-white">Smart Recommendation</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  recommendation.status === 'excellent' ? 'bg-yellow-500/20 text-yellow-300' :
                  recommendation.status === 'good' ? 'bg-green-500/20 text-green-300' :
                  recommendation.status === 'fair' ? 'bg-yellow-500/20 text-yellow-300' :
                  recommendation.status === 'ai-restricted' ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'
                }`}>
                  {recommendation.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-white/80 mb-3">{recommendation.message}</p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-white/60">Action:</span>
                  <p className="text-white/80">{recommendation.action}</p>
                </div>
                <div>
                  <span className="text-white/60">License:</span>
                  <p className="text-white/80">{recommendation.license}</p>
                </div>
              </div>

              <div className="mt-3 p-2 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-2">
                  {advancedResult.licenseRecommendation.aiLearningAllowed ? (
                    <Unlock className="h-3 w-3 text-green-400" />
                  ) : (
                    <Lock className="h-3 w-3 text-red-400" />
                  )}
                  <span className="text-xs text-white/70">AI Learning:</span>
                  <span className="text-xs text-white/90">{recommendation.aiLearning}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Detection Details */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${advancedResult.aiDetection.isAIGenerated ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {advancedResult.aiDetection.isAIGenerated ? (
                <Bot className="h-5 w-5 text-red-400" />
              ) : (
                <Eye className="h-5 w-5 text-green-400" />
              )}
            </div>

            <div className="flex-1">
              <h3 className="font-medium text-white mb-2">AI Detection Analysis</h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Detection:</span>
                  <span className={`text-sm font-medium ${advancedResult.aiDetection.isAIGenerated ? 'text-red-400' : 'text-green-400'}`}>
                    {advancedResult.aiDetection.isAIGenerated ? 'AI-Generated' : 'Human-Created'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Confidence:</span>
                  <span className={`text-sm font-medium ${getConfidenceColor(advancedResult.aiDetection.confidence)}`}>
                    {(advancedResult.aiDetection.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Learning Control:</span>
                  <span className={`text-sm font-medium ${
                    advancedResult.aiDetection.learningRestriction === 'disabled' ? 'text-red-400' :
                    advancedResult.aiDetection.learningRestriction === 'conditional' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {advancedResult.aiDetection.learningRestriction === 'disabled' ? '🚫 Disabled' :
                     advancedResult.aiDetection.learningRestriction === 'conditional' ? '⚠️ Conditional' : '✅ Enabled'}
                  </span>
                </div>

                {/* Confidence bar */}
                <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      advancedResult.aiDetection.confidence >= 0.8 ? 'bg-red-400' :
                      advancedResult.aiDetection.confidence >= 0.6 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${advancedResult.aiDetection.confidence * 100}%` }}
                  />
                </div>

                {/* AI Indicators */}
                {advancedResult.aiDetection.indicators.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs text-white/60 block mb-1">Detection Indicators:</span>
                    <div className="flex flex-wrap gap-1">
                      {advancedResult.aiDetection.indicators.slice(0, 3).map((indicator, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                          {indicator}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quality & IP Assessment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quality Assessment */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-blue-400" />
              <h3 className="font-medium text-white">Quality Assessment</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Overall:</span>
                <span className="text-sm font-medium text-white">{advancedResult.qualityAssessment.overall}/10</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Technical</span>
                  <span className="text-white/80">{Object.values(advancedResult.qualityAssessment.technical).reduce((a, b) => a + b, 0) / 5}/10</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Artistic</span>
                  <span className="text-white/80">{Object.values(advancedResult.qualityAssessment.artistic).reduce((a, b) => a + b, 0) / 4}/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* IP Eligibility */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <h3 className="font-medium text-white">IP Eligibility</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Score:</span>
                <span className={`text-sm font-medium ${
                  advancedResult.ipEligibility.score >= 80 ? 'text-green-400' :
                  advancedResult.ipEligibility.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {advancedResult.ipEligibility.score}/100
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Eligible:</span>
                <span className={`text-sm font-medium ${advancedResult.ipEligibility.isEligible ? 'text-green-400' : 'text-red-400'}`}>
                  {advancedResult.ipEligibility.isEligible ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Score bar */}
              <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    advancedResult.ipEligibility.score >= 80 ? 'bg-green-400' :
                    advancedResult.ipEligibility.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${advancedResult.ipEligibility.score}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* License Terms */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-medium text-white mb-3">Recommended License Terms</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-white/60 block">Type:</span>
              <span className="text-white/90">{advancedResult.licenseRecommendation.primary}</span>
            </div>
            <div>
              <span className="text-white/60 block">Minting Fee:</span>
              <span className="text-white/90">${advancedResult.licenseRecommendation.suggestedTerms.mintingFee}</span>
            </div>
            <div>
              <span className="text-white/60 block">Revenue Share:</span>
              <span className="text-white/90">{advancedResult.licenseRecommendation.suggestedTerms.commercialRevShare}%</span>
            </div>
            <div>
              <span className="text-white/60 block">Commercial Use:</span>
              <span className={`${advancedResult.licenseRecommendation.suggestedTerms.commercialUse ? 'text-green-400' : 'text-red-400'}`}>
                {advancedResult.licenseRecommendation.suggestedTerms.commercialUse ? 'Allowed' : 'Restricted'}
              </span>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5">
            <p className="text-xs text-white/70">{advancedResult.licenseRecommendation.reasoning}</p>
          </div>
        </div>

        {/* Content Tags */}
        <div className="flex flex-wrap gap-2">
          {advancedResult.content.tags.map((tag, index) => (
            <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Fallback to basic display
  if (!result) return null;

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${result.isAI ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
          {result.isAI ? (
            <Bot className="h-5 w-5 text-red-400" />
          ) : (
            <Eye className="h-5 w-5 text-green-400" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-white">Basic AI Detection</h3>
            {result.status === 'completed' && (
              <CheckCircle className="h-4 w-4 text-green-400" />
            )}
            {result.status === 'failed' && (
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Status:</span>
              <span className={`text-sm font-medium ${result.isAI ? 'text-red-400' : 'text-green-400'}`}>
                {result.isAI ? 'AI Detected' : 'Human/Original'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Confidence:</span>
              <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                {((result.confidence || 0) * 100).toFixed(1)}% ({getConfidenceText(result.confidence || 0)})
              </span>
            </div>

            {/* Confidence bar */}
            <div className="w-full bg-white/10 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  (result.confidence || 0) >= 0.8 ? 'bg-red-400' :
                  (result.confidence || 0) >= 0.6 ? 'bg-yellow-400' : 'bg-green-400'
                }`}
                style={{ width: `${(result.confidence || 0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
