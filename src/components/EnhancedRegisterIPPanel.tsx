"use client";

import React, { useState, useEffect } from "react";
import { Upload, X, FileImage, Sparkles, Brain, Zap } from "lucide-react";
import { LicenseSelector } from "./LicenseSelector";
import { AIDetectionDisplay } from "./AIDetectionDisplay";
import { LicenseRecommendationCard } from "./LicenseRecommendationCard";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAdvancedAIDetection } from "@/hooks/useAdvancedAIDetection";
import { useAccount } from "wagmi";
import { DEFAULT_LICENSE_SETTINGS, type LicenseSettings } from "@/lib/license/terms";
import { AdvancedAnalysisResult, SimpleRecommendation, AIMetadata } from "@/types/ai-detection";
import { CameraCapture } from "./agent/CameraCapture";
import { compressImage } from "@/lib/utils/image";
import ManualReviewModal from "./agent/ManualReviewModal";
import { getFaceEmbedding, cosineSimilarity, countFaces, preloadFaceModels } from "@/lib/utils/face";

interface EnhancedRegisterIPPanelProps {
  onRegister?: (
    file: File, 
    title: string, 
    description: string, 
    license: LicenseSettings, 
    aiResult?: {
      analysis: AdvancedAnalysisResult;
      recommendation: SimpleRecommendation;
      metadata: AIMetadata;
    }
  ) => void;
  className?: string;
}

export function EnhancedRegisterIPPanel({ onRegister, className = "" }: EnhancedRegisterIPPanelProps) {
  const { address } = useAccount();
  const fileUpload = useFileUpload();
  const { analysis, recommendation, metadata, isAnalyzing, error, analyzeImageFromBase64, reset } = useAdvancedAIDetection();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLicense, setSelectedLicense] = useState<LicenseSettings>(DEFAULT_LICENSE_SETTINGS);
  const [showLicenseSelector, setShowLicenseSelector] = useState(false);
  const [useRecommendedLicense, setUseRecommendedLicense] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showManualReview, setShowManualReview] = useState(false);

  // Auto-analyze when file is uploaded
  useEffect(() => {
    if (fileUpload.file && fileUpload.previewUrl && !hasAnalyzed) {
      const analyzeFile = async () => {
        try {
          // Compress then convert to base64
          const compressed = await compressImage(fileUpload.file, { maxDim: 1024, quality: 0.7, targetMaxBytes: 600 * 1024 });
          const reader = new FileReader();
          reader.onload = async (e) => {
            if (e.target?.result) {
              const base64 = (e.target.result as string).split(',')[1];
              await analyzeImageFromBase64(base64, address);
              setHasAnalyzed(true);
            }
          };
          reader.readAsDataURL(compressed);
        } catch (err) {
          console.error('Auto-analysis failed:', err);
        }
      };
      analyzeFile();
    }
  }, [fileUpload.file, fileUpload.previewUrl, hasAnalyzed, analyzeImageFromBase64, address]);

  // Auto-fill metadata from AI analysis
  useEffect(() => {
    if (analysis && !title && !description) {
      setTitle(analysis.content.description.slice(0, 50) + (analysis.content.description.length > 50 ? '...' : ''));
      setDescription(analysis.content.description);
    }
  }, [analysis, title, description]);

  // Auto-apply recommended license
  useEffect(() => {
    if (analysis && recommendation && useRecommendedLicense) {
      const st = analysis.licenseRecommendation.suggestedTerms;
      const pilType = (st.commercialUse && st.derivativesAllowed) ? 'commercial_remix' : (
        analysis.licenseRecommendation.primary === 'commercial' ? 'commercial_use' : (
          analysis.licenseRecommendation.primary === 'remix' ? 'non_commercial_remix' : 'open_use'
        )
      );
      const recommendedLicense: LicenseSettings = {
        pilType,
        commercialUse: (pilType === 'commercial_use' || pilType === 'commercial_remix') || ((st.mintingFee || 0) > 0),
        derivativesAllowed: st.derivativesAllowed,
        derivativesAttribution: true,
        attribution: true,
        revShare: st.commercialRevShare,
        licensePrice: st.mintingFee,
        transferable: true,
        aiLearning: !st.aiTrainingRestricted,
        expiration: '0',
        territory: 'Global',
      } as LicenseSettings;
      setSelectedLicense(recommendedLicense);
    }
  }, [analysis, recommendation, useRecommendedLicense]);

  // Sync commercialUse with licensePrice, but force ON for commercial_* types
  useEffect(() => {
    const shouldBeCommercial = (selectedLicense.pilType === 'commercial_use' || selectedLicense.pilType === 'commercial_remix') || ((selectedLicense.licensePrice || 0) > 0);
    if (selectedLicense.commercialUse !== shouldBeCommercial) {
      setSelectedLicense(prev => ({ ...prev, commercialUse: shouldBeCommercial }));
    }
  }, [selectedLicense.licensePrice, selectedLicense.pilType]);

  const handleFileRemove = () => {
    fileUpload.removeFile();
    reset();
    setHasAnalyzed(false);
    setTitle("");
    setDescription("");
    setUseRecommendedLicense(false);
    setIdentityVerified(false);
  };

  const handleRegister = () => {
    if (fileUpload.file && onRegister) {
      const aiResult = analysis && recommendation && metadata ? {
        analysis,
        recommendation,
        metadata
      } : undefined;

      onRegister(fileUpload.file, title, description, selectedLicense, aiResult);
    }
  };

  const requireSelfie = !!(analysis?.content.containsHumanFace && !analysis?.content.famousPersonDetected);
  const blockedByPolicy = !!(analysis?.content.famousBrandOrCharacterDetected || analysis?.content.famousPersonDetected);

  const verifyWithCapture = async (capture: File) => {
    if (!fileUpload.file) return;
    try {
      await preloadFaceModels();
      const faces = await countFaces(capture).catch(() => 0);
      if (faces > 1) return;
      const [refEmb, capEmb] = await Promise.all([
        getFaceEmbedding(fileUpload.file),
        getFaceEmbedding(capture)
      ]);
      if (refEmb && capEmb) {
        const simTh = parseFloat(process.env.NEXT_PUBLIC_FACE_SIM_THRESHOLD || '0.82');
        const sim = cosineSimilarity(refEmb, capEmb);
        if (sim >= simTh) setIdentityVerified(true);
      }
    } catch {}
  };

  const handleAcceptRecommendation = () => {
    setUseRecommendedLicense(true);
    setShowLicenseSelector(false);
  };

  const handleCustomizeLicense = () => {
    setUseRecommendedLicense(false);
    setShowLicenseSelector(true);
  };

  const canRegister = !!(fileUpload.file && title.trim() && description.trim() && !blockedByPolicy && (!requireSelfie || identityVerified));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Brain className="h-6 w-6 text-ai-primary" />
          <h2 className="text-xl font-semibold text-white">Smart IP Registration</h2>
        </div>
        <p className="text-sm text-white/70">
          Upload your content for advanced AI analysis and intelligent license recommendations
        </p>
      </div>

      {/* File Upload */}
      <div className="space-y-4">
        {!fileUpload.file ? (
          <div
            onClick={() => document.getElementById('enhanced-file-input')?.click()}
            className="relative border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-ai-primary/50 hover:bg-ai-primary/5 transition-all cursor-pointer group"
          >
            <input
              id="enhanced-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => fileUpload.handleFileSelect(e.target.files?.[0])}
            />
            
            <div className="space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-ai-primary/20 flex items-center justify-center group-hover:bg-ai-primary/30 transition-colors">
                <Upload className="h-8 w-8 text-ai-primary" />
              </div>
              <div>
                <p className="text-white font-medium">Upload Image for AI Analysis</p>
                <p className="text-sm text-white/60">PNG, JPG, GIF up to 10MB</p>
                <p className="text-xs text-ai-accent mt-1">
                  🤖 Automatic AI detection • 🎯 Quality assessment • 📋 License recommendations
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={fileUpload.previewUrl!}
                  alt="Preview"
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <button
                  onClick={handleFileRemove}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileImage className="h-4 w-4 text-ai-primary" />
                  <span className="font-medium text-white truncate">{fileUpload.file.name}</span>
                  {isAnalyzing && <Zap className="h-4 w-4 text-ai-accent animate-pulse" />}
                </div>
                <p className="text-xs text-white/60">
                  {(fileUpload.file.size / 1024 / 1024).toFixed(2)} MB
                  {hasAnalyzed && analysis && (
                    <span className="ml-2 text-ai-accent">
                      • AI Analysis Complete
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Results */}
      {fileUpload.file && (
        <AIDetectionDisplay
          isAnalyzing={isAnalyzing}
          advancedResult={analysis || undefined}
          recommendation={recommendation || undefined}
          className="mt-4"
        />
      )}

      {/* Policy banners */}
      {analysis && (analysis.content.famousBrandOrCharacterDetected || analysis.content.famousPersonDetected) && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-300 text-sm font-medium">Registration blocked</p>
          <p className="text-red-200/80 text-xs mt-1">Detected famous brand/character or celebrity face. Only manual review is allowed.</p>
          <div className="mt-3">
            <button onClick={() => setShowManualReview(true)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm">Submit for Review</button>
          </div>
        </div>
      )}

      {analysis && requireSelfie && !identityVerified && !blockedByPolicy && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-yellow-300 text-sm font-medium">Selfie verification required</p>
          <p className="text-yellow-200/80 text-xs mt-1">We detected a human face. Please verify with a selfie that matches the subject.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setShowCamera(true)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm">Take Selfie</button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-300 text-sm">
            <strong>Analysis Error:</strong> {error}
          </p>
          <p className="text-red-200/70 text-xs mt-1">
            You can still register your IP without AI analysis.
          </p>
        </div>
      )}

      {/* License Recommendation */}
      {analysis && recommendation && (
        <LicenseRecommendationCard
          analysis={analysis}
          recommendation={recommendation}
          onAcceptRecommendation={handleAcceptRecommendation}
          onCustomizeLicense={handleCustomizeLicense}
          className="mt-4"
        />
      )}

      {/* IP Metadata */}
      {fileUpload.file && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="w-2 h-2 bg-ai-primary rounded-full"></div>
            IP Information
            {analysis && (
              <span className="text-xs px-2 py-1 rounded-full bg-ai-primary/20 text-ai-primary">
                AI-Enhanced
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                IP Title *
                {analysis && (
                  <span className="text-xs text-ai-accent ml-2">(AI-suggested)</span>
                )}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title for your IP"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:border-ai-primary/50 focus:ring-1 focus:ring-ai-primary/30 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Description *
                {analysis && (
                  <span className="text-xs text-ai-accent ml-2">(AI-generated)</span>
                )}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your IP..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:border-ai-primary/50 focus:ring-1 focus:ring-ai-primary/30 focus:outline-none resize-none"
              />
              {analysis && (
                <p className="text-xs text-white/60 mt-1">
                  Quality Score: {analysis.qualityAssessment.overall}/10 • 
                  IP Eligibility: {analysis.ipEligibility.score}/100
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* License Configuration */}
      {fileUpload.file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="w-2 h-2 bg-ai-accent rounded-full"></div>
              License Settings
              {useRecommendedLicense && (
                <span className="text-xs px-2 py-1 rounded-full bg-ai-accent/20 text-ai-accent">
                  AI-Recommended
                </span>
              )}
            </div>
            {!useRecommendedLicense && (
              <button
                onClick={() => setShowLicenseSelector(!showLicenseSelector)}
                className="text-xs px-3 py-1 rounded-full bg-ai-primary/20 text-ai-primary hover:bg-ai-primary/30 transition-colors"
              >
                {showLicenseSelector ? 'Hide' : 'Customize'}
              </button>
            )}
          </div>

          {/* Current license preview */}
          <div className={`p-3 rounded-lg border ${
            useRecommendedLicense ? 'bg-ai-accent/10 border-ai-accent/20' : 'bg-ai-primary/10 border-ai-primary/20'
          }`}>
            <div className={`text-sm font-medium mb-1 ${
              useRecommendedLicense ? 'text-ai-accent' : 'text-ai-primary'
            }`}>
              Active License:
              {useRecommendedLicense && (
                <span className="ml-2 text-xs">(AI-Recommended)</span>
              )}
            </div>
            <div className="text-sm text-white/80">
              {selectedLicense.pilType === 'open_use' && '🎁 Open Use - Free for non-commercial use'}
              {selectedLicense.pilType === 'non_commercial_remix' && '🔄 Non-Commercial Remix - Remixing allowed, non-commercial'}
              {selectedLicense.pilType === 'commercial_use' && '💼 Commercial Use - Commercial allowed, no remixing'}
              {selectedLicense.pilType === 'commercial_remix' && '🎨 Commercial Remix - Commercial + remix with revenue sharing'}
            </div>
            {analysis && (
              <div className="text-xs text-white/60 mt-1 space-y-1">
                <p>• AI Training: {analysis.aiDetection.isAIGenerated ? '🚫 Restricted (fixed)' : (selectedLicense.aiLearning ? '✅ Allowed' : '🚫 Restricted')}</p>
                <p>• Minting Fee: ${selectedLicense.licensePrice || 0}</p>
                {selectedLicense.commercialUse && (
                  <p>• Revenue Share: {selectedLicense.revShare}%</p>
                )}
              </div>
            )}
          </div>

          {/* Custom license selector */}
          {showLicenseSelector && !useRecommendedLicense && (
            <LicenseSelector
              selectedLicense={selectedLicense}
              onLicenseChange={setSelectedLicense}
            />
          )}
        </div>
      )}

      {/* Register Button */}
      {fileUpload.file && !blockedByPolicy && (
        <button
          onClick={handleRegister}
          disabled={!canRegister}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-ai-primary to-ai-accent text-white font-medium hover:from-ai-primary/80 hover:to-ai-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {canRegister ? 'Register IP with AI Analysis' : (requireSelfie && !identityVerified ? 'Verify selfie to continue' : 'Complete information to continue')}
        </button>
      )}

      {/* Modals */}
      <CameraCapture
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={async (f) => { await verifyWithCapture(f); setShowCamera(false); }}
        onFallback={() => setShowCamera(false)}
      />
      <ManualReviewModal
        open={showManualReview}
        onClose={() => setShowManualReview(false)}
      />

      {/* Enhanced Summary */}
      {fileUpload.file && canRegister && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <h4 className="font-medium text-white mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ai-primary" />
            Registration Summary
          </h4>
          <div className="text-sm space-y-1 text-white/70">
            <p>• <strong>File:</strong> {fileUpload.file.name}</p>
            <p>• <strong>Title:</strong> {title}</p>
            <p>• <strong>License:</strong> {selectedLicense.pilType}</p>
            <p>• <strong>Commercial Use:</strong> {selectedLicense.commercialUse ? 'Yes' : 'No'}</p>
            {analysis && (
              <>
                <p>• <strong>AI Status:</strong> {analysis.aiDetection.isAIGenerated ? 'AI-Generated' : 'Human-Created'} ({Math.round(analysis.aiDetection.confidence * 100)}%)</p>
                <p>• <strong>Quality Score:</strong> {analysis.qualityAssessment.overall}/10</p>
                <p>• <strong>IP Eligibility:</strong> {analysis.ipEligibility.score}/100</p>
                <p>• <strong>AI Training:</strong> {selectedLicense.aiLearning ? 'Allowed' : 'Restricted'}</p>
              </>
            )}
          </div>
          {useRecommendedLicense && recommendation && (
            <div className="mt-2 p-2 rounded-lg bg-ai-accent/10 border border-ai-accent/20">
              <p className="text-xs text-ai-accent">
                <strong>🤖 AI Recommendation Applied:</strong> {recommendation.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
