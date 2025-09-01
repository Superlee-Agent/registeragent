import React, { useRef, useEffect, useCallback, useState } from "react";
import { usePublicClient } from "wagmi";
import { storyAeneid } from "@/lib/chains/story";
import { waitForTxConfirmation } from "@/lib/utils/transaction";
import { useChatAgent } from "@/hooks/useChatAgent";
import { useRegisterIPAgent } from "@/hooks/useRegisterIPAgent";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAdvancedAIDetection } from "@/hooks/useAdvancedAIDetection";
import { DEFAULT_LICENSE_SETTINGS } from "@/lib/license/terms";
import type { LicenseSettings } from "@/lib/license/terms";
import type { AdvancedAnalysisResult, SimpleRecommendation } from "@/types/ai-detection";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { PlanBox } from "./PlanBox";
import { HistorySidebar } from "./HistorySidebar";
import { Toast } from "./Toast";
import { CameraCapture } from "./CameraCapture";
import { AIStatusIndicator } from "../AIStatusIndicator";
import { useI18n } from "@/lib/i18n/I18nProvider";
import SimpleLicenseWizard from "@/components/SimpleLicenseWizard";
import ManualReviewModal from "@/components/agent/ManualReviewModal";
import { loadIndexFromIpfs } from "@/lib/rag";
import { detectIPStatus } from "@/services";
import { isWhitelistedImage, computeDHash } from "@/lib/utils/whitelist";
import { compressImage } from "@/lib/utils/image";
import { sha256HexOfFile } from "@/lib/utils/crypto";
import { checkDuplicateQuick, checkDuplicateByImageHash } from "@/lib/utils/registry";
import { getFaceEmbedding, cosineSimilarity, countFaces, preloadFaceModels } from "@/lib/utils/face";
import type { Hex } from "viem";
import { useRouter } from "next/navigation";

export function EnhancedAgentOrchestrator() {
  const chatAgent = useChatAgent();
  const registerAgent = useRegisterIPAgent();
  const fileUpload = useFileUpload();
  const { analysis, recommendation, analyzeImageFromBase64, reset: resetAIAnalysis } = useAdvancedAIDetection();
  const publicClient = usePublicClient();
  
  const [toast, setToast] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedFile, setAnalyzedFile] = useState<File | null>(null);
  const [lastDHash, setLastDHash] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [awaitingIdentity, setAwaitingIdentity] = useState<boolean>(false);
  const [dupCheck, setDupCheck] = useState<{ checked: boolean; found: boolean; tokenId?: string } | null>(null);
  const [showCustomLicense, setShowCustomLicense] = useState(false);
  const [customTerms, setCustomTerms] = useState<import("@/lib/license/terms").LicenseTermsData | null>(null);
  const [selectedPilType, setSelectedPilType] = useState<'open_use' | 'commercial_remix'>('commercial_remix');
  const [selectedRevShare, setSelectedRevShare] = useState<number>(0);
  const [selectedLicensePrice, setSelectedLicensePrice] = useState<number>(0);
  const [selectedAiLearning, setSelectedAiLearning] = useState<boolean>(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [ragLoaded, setRagLoaded] = useState<string | null>(null);
  const [showManualReview, setShowManualReview] = useState(false);
  const [lastAIResult, setLastAIResult] = useState<AdvancedAnalysisResult | null>(null);
  const [lastAIRec, setLastAIRec] = useState<SimpleRecommendation | null>(null);
  const [smartApplied, setSmartApplied] = useState(false);
  const { t } = useI18n();

  const handleNewChat = useCallback(() => {
    chatAgent.newChat();
    try { fileUpload.removeFile(); } catch {}
    setAnalyzedFile(null);
    
    setReferenceFile(null);
    setAwaitingIdentity(false);
    setShowCamera(false);
    setLastDHash(null);
    setDupCheck(null);
    setToast(null);
    setSmartApplied(false);
  }, [chatAgent, fileUpload]);

  const handleOpenSession = useCallback((id: string) => {
    chatAgent.openSession(id);
    try { fileUpload.removeFile(); } catch {}
    setAnalyzedFile(null);
    
    setReferenceFile(null);
    setAwaitingIdentity(false);
    setShowCamera(false);
    setLastDHash(null);
    setDupCheck(null);
    setToast(null);
    setSmartApplied(false);
  }, [chatAgent, fileUpload]);

  const explorerBase = storyAeneid.blockExplorers?.default.url || "https://aeneid.storyscan.xyz";

  // Load RAG index (from localStorage or env)
  useEffect(() => {
    const url = (typeof window !== 'undefined' && localStorage.getItem('ragIndexUrl')) || process.env.NEXT_PUBLIC_RAG_INDEX_URL;
    if (url) {
      (async () => {
        try {
          const index = await loadIndexFromIpfs(url);
          (chatAgent as any).engine?.setRagIndex?.(index);
          setRagLoaded(url as string);
        } catch {}
      })();
    }
    // Preload face models in idle time
    const idle = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === 'function') (window as any).requestIdleCallback(cb, { timeout: 2000 });
      else setTimeout(cb, 500);
    };
    idle(() => { preloadFaceModels().catch(() => {}); });
  }, [chatAgent]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatAgent.messages]);

  // Auto-analyze AI when file is uploaded
  useEffect(() => {
    if (!fileUpload.file) return;
    if (awaitingIdentity && referenceFile) {
      verifyIdentityPhoto(fileUpload.file).finally(() => {
        try { (fileInputRef.current as any)?.value && (fileInputRef.current!.value = ''); } catch {}
        try { (cameraInputRef.current as any)?.value && (cameraInputRef.current!.value = ''); } catch {}
        fileUpload.removeFile();
      });
      return;
    }
    if (!isAnalyzing) {
      analyzeImageForChat();
    }
  }, [fileUpload.file]);

  const analyzeImageForChat = async () => {
    if (!fileUpload.file) return;

    setIsAnalyzing(true);
    

    // Add immediate loading message when starting analysis
    const loadingMessage = {
      role: "agent" as const,
      text: "🧠 Analyzing your image with advanced AI detection...\n\n• Detecting AI-generated content\n• Assessing quality & originality\n• Calculating IP eligibility\n• Generating license recommendations",
      ts: Date.now(),
      isLoading: true
    };

    chatAgent.addCompleteMessage(loadingMessage);

    // Store file reference before removing preview
    const currentFile = fileUpload.file;
    setAnalyzedFile(currentFile);

    // Create an object URL for preview image in chat (separate from upload preview)
    const previewUrl = URL.createObjectURL(currentFile);

    // Remove image preview from uploader immediately after upload
    setTimeout(() => {
      fileUpload.removeFile();
    }, 100);

    try {
      // Convert file to base64 for AI analysis
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => {
          if (e.target?.result) {
            const base64 = (e.target.result as string).split(',')[1];
            resolve(base64);
          }
        };
        reader.readAsDataURL(currentFile);
      });

      const base64 = await base64Promise;

      // Run advanced AI analysis and whitelist check in parallel
      const wlPromise = isWhitelistedImage(currentFile);

      let aiAnalysisPromise: Promise<any>;
      try {
        aiAnalysisPromise = fetch('/api/ai/analyze-advanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        }).then(async res => {
          const data = await res.json();
          if (!res.ok) {
            console.error('AI Analysis API Error:', data);
            throw new Error(data.error || 'API request failed');
          }
          return data;
        });
      } catch (err) {
        console.error('AI Analysis Request Error:', err);
        aiAnalysisPromise = Promise.resolve({ success: false, error: err instanceof Error ? err.message : 'Request failed' });
      }

      const [aiAnalysisResult, wlSettled] = await Promise.allSettled([aiAnalysisPromise, wlPromise]);

      // Handle whitelist result
      const wl = wlSettled.status === 'fulfilled' ? wlSettled.value : { whitelisted: false, reason: '', hash: '' };

      // Get AI analysis results
      let aiResult: AdvancedAnalysisResult | null = null;
      let aiRecommendation: SimpleRecommendation | null = null;

      if (aiAnalysisResult.status === 'fulfilled' && aiAnalysisResult.value?.success) {
        aiResult = aiAnalysisResult.value.analysis;
        aiRecommendation = aiAnalysisResult.value.recommendation;
        setLastAIResult(aiResult);
        setLastAIRec(aiRecommendation);
      } else {
        // Log AI analysis failure for debugging
        console.warn('AI Analysis failed:', {
          status: aiAnalysisResult.status,
          value: aiAnalysisResult.status === 'fulfilled' ? aiAnalysisResult.value : undefined,
          reason: aiAnalysisResult.status === 'rejected' ? aiAnalysisResult.reason : undefined
        });
      }

      // Create simplified chat message
      let ipText = "";

      if (aiResult && aiRecommendation) {
        const isHighConfidenceAI = aiResult.aiDetection.isAIGenerated && aiResult.aiDetection.confidence >= 0.85;
        const mainTitle = isHighConfidenceAI ? '��� AI Content' : '✨ Great Work';
        const subtitle = isHighConfidenceAI ? 'This looks like it was made by AI' : 'Looks human-made';
        // Policy override: Human-created defaults to Commercial Remix
        const primaryPolicy = !aiResult.aiDetection.isAIGenerated ? 'remix' : aiResult.licenseRecommendation.primary;
        const nextAction = primaryPolicy === 'commercial'
          ? 'Sell (Commercial License)'
          : primaryPolicy === 'remix'
          ? 'Register Remix License'
          : 'Share for Free';

        ipText = `${mainTitle}\n${subtitle}\nNext: ${nextAction}`;

      } else {
        // Fallback to basic analysis with more detailed error info
        let errorInfo = "";
        if (aiAnalysisResult.status === 'fulfilled' && aiAnalysisResult.value) {
          const errorData = aiAnalysisResult.value;
          if (errorData.details) {
            errorInfo = `\nError: ${errorData.details}`;
          }
          if (errorData.apiKeyConfigured === false) {
            errorInfo += `\nIssue: OpenAI API key not configured`;
          }
        } else if (aiAnalysisResult.status === 'rejected') {
          errorInfo = `\nError: ${aiAnalysisResult.reason}`;
        }

        ipText = wl.whitelisted ?
          `✅ **Whitelisted Content**\n\nStatus: Pre-approved for registration\nRisk: Low\nTolerance: Good to register\n\n⚠️ Note: Advanced AI analysis unavailable${errorInfo}` :
          `📋 **Basic Assessment**\n\nStatus: Standard evaluation\nRisk: Medium\nTolerance: Proceed with caution\n\n⚠️ **Advanced AI analysis unavailable**${errorInfo}\n\n💡 Troubleshooting:
• Check if OpenAI API key is configured
• Verify network connectivity
• Visit /ai-debug for detailed diagnostics
• Contact admin for API configuration

🔧 Enhanced features when AI is working:
• AI content detection
• Quality & IP eligibility scoring
• Smart license recommendations
• AI learning controls`;
      }

      // Whitelist override: If whitelisted, always treat as safe
      if (wl.whitelisted) {
        ipText = `✅ **Whitelisted Content Detected**\n\nStatus: Pre-approved for registration\nRisk: Low\nTolerance: Good to register\n\n${aiResult ? '🧠 AI analysis also available above.' : ''}`;
      }

      setLastDHash(wl.hash || null);

      // Duplicate check (after safety analysis)
      let dupFound = false;
      let dupTokenId: string | undefined;
      try {
        const spg = process.env.NEXT_PUBLIC_SPG_COLLECTION as `0x${string}` | undefined;
        if (spg && publicClient) {
          const compressed = await compressImage(currentFile);
          const imageHash = (await sha256HexOfFile(compressed)).toLowerCase();
          const timeoutMs = Number.parseInt(process.env.NEXT_PUBLIC_REGISTRY_DUPCHECK_TIMEOUT_MS || '3000', 10);
          const withTimeout = <T,>(p: Promise<T>) => new Promise<T>((resolve) => {
            const t = setTimeout(() => resolve(null as any), timeoutMs);
            p.then(v => { clearTimeout(t); resolve(v); }).catch(() => { clearTimeout(t); resolve(null as any); });
          });
          const quick = await withTimeout(checkDuplicateQuick(publicClient, spg, imageHash));
          if (quick?.found) { dupFound = true; dupTokenId = quick.tokenId; }
          if (!dupFound) {
            const full = await withTimeout(checkDuplicateByImageHash(publicClient, spg, imageHash));
            if (full?.found) { dupFound = true; dupTokenId = full.tokenId; }
          }
        }
      } catch {}
      finally {
        setDupCheck({ checked: true, found: dupFound, tokenId: dupTokenId });
      }

      // Decide next action based on AI analysis and whitelist
      let isRisky = false;
      let riskLow = true;
      let toleranceGood = true;

      if (aiResult) {
        // Use AI analysis to determine risk
        const isHighConfidenceAI = aiResult.aiDetection.isAIGenerated && aiResult.aiDetection.confidence >= 0.85;
        const isHuman = !isHighConfidenceAI;
        if (isHuman) {
          // User request: if OpenAI doesn't recognize as AI, allow registration
          riskLow = true;
          toleranceGood = true;
          isRisky = false;
        } else {
          riskLow = aiResult.ipEligibility.score >= 60;
          toleranceGood = aiResult.ipEligibility.isEligible;
          isRisky = !toleranceGood || isHighConfidenceAI;
        }
      } else {
        // Fallback to text parsing
        const riskLine = (ipText.split('\n').find(l => l.toLowerCase().startsWith('risk:')) || '').toLowerCase();
        const toleranceLineRaw = ipText.split('\n').find(l => l.toLowerCase().startsWith('tolerance:')) || '';
        const toleranceValue = toleranceLineRaw.split(':').slice(1).join(':').trim().toLowerCase();
        riskLow = riskLine.includes('low');
        toleranceGood = toleranceValue.startsWith('good to register');
        isRisky = !(riskLow && toleranceGood);
      }

      // Whitelist override
      if (wl.whitelisted) {
        isRisky = false;
        riskLow = true;
        toleranceGood = true;
      }

      // Detect human face to offer camera capture option
      let faceDetected = false;
      try {
        // Prefer local FaceDetector API when available
        // @ts-ignore
        if (typeof window !== 'undefined' && window.FaceDetector) {
          // @ts-ignore
          const detector = new window.FaceDetector({ fastMode: true });
          const bitmap = await createImageBitmap(currentFile);
          const faces = await detector.detect(bitmap as any);
          faceDetected = Array.isArray(faces) && faces.length > 0;
        } else {
          // Fallback: keyword hints from OpenAI text
          const ipAll = ipText.toLowerCase();
          faceDetected = /face|faces|portrait|person|people|identity/.test(ipAll);
        }
      } catch {}

      // Identity requirement using AI flags or text hints
      let requiresIdentity = /identity|face|faces|portrait|person|people/.test(ipText.toLowerCase());
      if (aiResult && aiResult.content.containsHumanFace && !aiResult.content.famousPersonDetected) {
        requiresIdentity = true;
      }
      if (requiresIdentity) {
        setReferenceFile(currentFile);
        setAwaitingIdentity(true);
      }

      // Compose buttons based on analysis
      let buttons: string[] = [];

      const blockedByPolicy = !!(aiResult && (aiResult.content.famousBrandOrCharacterDetected || aiResult.content.famousPersonDetected));

      if (dupFound) {
        buttons = ["Upload File", "Submit for Review", "Copy dHash"];
      } else if (blockedByPolicy) {
        buttons = ["Upload File", "Submit for Review", "Copy dHash"];
      } else if (isRisky) {
        buttons = ["Upload File", "Submit for Review", "Copy dHash"];
      } else {
        // Safe to register - show minimal actions in chat
        if (aiResult && aiRecommendation) {
          buttons = ["🧠 Smart License", "Copy dHash"];
        } else {
          buttons = ["Copy dHash"];
        }
      }
      if ((faceDetected || requiresIdentity) && !blockedByPolicy) {
        const cameraOnly = (process.env.NEXT_PUBLIC_CAMERA_ONLY_ON_FACE ?? 'false') === 'true';
        if (!buttons.includes("Take Photo")) buttons = ["Take Photo", ...buttons];
        if (cameraOnly) {
          buttons = buttons.filter(b => b !== "Upload File");
        }
      }
      if (requiresIdentity) {
        buttons = buttons.filter(b => b !== "Continue Registration");
      }

      if (!buttons.includes("Why?")) buttons.push("Why?");

      // If duplicate, hide safe IP text and show remix tolerance guidance
      const duplicateBlockText = `\n\nDuplicate detected: this image is already registered as IP${dupTokenId ? ` (Token ID: ${dupTokenId})` : ''}. Registration is blocked.\nTolerance: Allowed to register as a remix`;
      const textToShow = dupFound ? `${ipText}${duplicateBlockText}` : ipText;

      // Update the loading message to show results with appropriate next step and image preview
      const finalText = (aiResult && (aiResult.content.famousBrandOrCharacterDetected || aiResult.content.famousPersonDetected))
        ? `${ipText}\n\n❌ Registration not allowed due to brand/celebrity detection. You can submit for manual review.`
        : textToShow;
      chatAgent.updateLastMessage({
        text: finalText,
        isLoading: false,
        buttons,
        image: { url: previewUrl, alt: currentFile.name }
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      // Update loading message to show error
      const errorText = "❌ Sorry, I couldn't analyze the image. But don't worry, you can still proceed with registration!";

      chatAgent.updateLastMessage({
        text: errorText,
        isLoading: false
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const executePlan = useCallback(async () => {
    if (!chatAgent.currentPlan) return;

    const plan = chatAgent.currentPlan;

    if (plan.type === "register" && plan.intent.kind === "register") {
      // Get file from engine context or fallback to analyzed file
      const fileToUse = chatAgent.getEngineFile() || analyzedFile;

      if (!fileToUse) {
        chatAgent.addMessage("agent", "❌ Please attach an image first!");
        setToast("Attach image first 📎");
        return;
      }

      // Duplicate check before signing (skip if already checked safe during analysis)
      const alreadyCheckedSafe = dupCheck?.checked && !dupCheck.found;
      if (!alreadyCheckedSafe) {
        try {
          const { compressImage } = await import("@/lib/utils/image");
          const { sha256HexOfFile } = await import("@/lib/utils/crypto");
          const { checkDuplicateByImageHash, checkDuplicateQuick } = await import("@/lib/utils/registry");
          const spg = process.env.NEXT_PUBLIC_SPG_COLLECTION as `0x${string}` | undefined;
          if (spg && publicClient) {
            const compressed = await compressImage(fileToUse);
            const imageHash = (await sha256HexOfFile(compressed)).toLowerCase();
            const timeoutMs = Number.parseInt(process.env.NEXT_PUBLIC_REGISTRY_DUPCHECK_TIMEOUT_MS || '3000', 10);
            const withTimeout = <T,>(p: Promise<T>) => new Promise<T>((resolve, reject) => {
              const t = setTimeout(() => resolve(null as any), timeoutMs);
              p.then(v => { clearTimeout(t); resolve(v); }).catch(e => { clearTimeout(t); reject(e); });
            });
            const quick = await withTimeout(checkDuplicateQuick(publicClient, spg, imageHash));
            if (quick?.found) {
              chatAgent.addMessage("agent", `❌ This image is already registered as IP (Token ID: ${quick.tokenId}). Registration blocked.`);
              setToast("Duplicate image detected ❌");
              chatAgent.clearPlan();
              return;
            }
            const dup = await withTimeout(checkDuplicateByImageHash(publicClient, spg, imageHash));
            if (dup?.found) {
              chatAgent.addMessage("agent", `❌ This image is already registered as IP (Token ID: ${dup.tokenId}). Registration blocked.`);
              setToast("Duplicate image detected ❌");
              chatAgent.clearPlan();
              return;
            }
          }
        } catch (e) {
          console.warn("Duplicate pre-check failed:", e);
        }
      }

      chatAgent.updateStatus("📝 Registering IP...");

      // Use default license settings from the plan
      const licenseSettings: LicenseSettings = {
        ...DEFAULT_LICENSE_SETTINGS,
        pilType: plan.intent.pilType || DEFAULT_LICENSE_SETTINGS.pilType,
      };

      const merged = { ...licenseSettings } as LicenseSettings;
      if (selectedPilType) merged.pilType = selectedPilType as any;
      merged.aiLearning = !!selectedAiLearning && !(lastAIResult?.aiDetection.isAIGenerated);
      if (selectedPilType === 'commercial_remix') {
        if (!isNaN(selectedRevShare)) merged.revShare = selectedRevShare;
        if (!isNaN(selectedLicensePrice)) merged.licensePrice = selectedLicensePrice;
      } else {
        merged.revShare = 0; merged.licensePrice = 0;
      }
      const result = await registerAgent.executeRegister(plan.intent, fileToUse, merged, customTerms ? { customTerms } : undefined);

      if (result.success) {
        // Show initial success with transaction link
        const submittedMessage = `Tx submitted ⏳\n↗ View: ${explorerBase}/tx/${result.txHash}`;
        chatAgent.addMessage("agent", submittedMessage);

        // Wait for confirmation
        try {
          chatAgent.updateStatus("Waiting for confirmation...");
          const confirmed = await waitForTxConfirmation(
            publicClient, 
            result.txHash as Hex,
            { timeoutMs: 90_000 }
          );

          if (confirmed) {
            const successText = `Register success ✅

Your image has been successfully registered as IP!

License Type: ${result.licenseType}`;

            // Create message with image and links
            const message = {
              role: "agent" as const,
              text: successText,
              ts: Date.now(),
              image: result.imageUrl ? {
                url: result.imageUrl,
                alt: "Registered IP image"
              } : undefined,
              links: [
                {
                  text: `📋 View IP: ${result.ipId}`,
                  url: `https://aeneid.explorer.story.foundation/ipa/${result.ipId}`
                },
                {
                  text: `🔗 View Transaction: ${result.txHash}`,
                  url: `${explorerBase}/tx/${result.txHash}`
                }
              ]
            };

            chatAgent.addCompleteMessage(message);
            setToast("IP registered ✅");
          } else {
            chatAgent.updateStatus("Tx still pending on network. Check explorer.");
          }
        } catch {
          chatAgent.updateStatus("Tx still pending on network. Check explorer.");
        }
      } else {
        chatAgent.addMessage("agent", `Register error: ${result.error}`);
        setToast("Register error ❌");
      }
      
      chatAgent.clearPlan();
      registerAgent.resetRegister();
      setAnalyzedFile(null);
      setCustomTerms(null);
    }
  }, [
    chatAgent,
    registerAgent,
    analyzedFile,
    publicClient,
    explorerBase
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const handleButtonClick = useCallback((buttonText: string) => {
    if (buttonText === "Register IP") {
      // Start register flow by asking for file directly (no chat prompt)
      fileInputRef.current?.click();
      return;
    }
    if (buttonText === t("buttons.uploadFile") || buttonText === "Upload File") {
      fileInputRef.current?.click();
    } else if (buttonText === "🧠 Smart License") {
      // Apply AI-recommended license settings from last analysis
      if (lastAIResult && lastAIRec) {
        const isHuman = !lastAIResult.aiDetection.isAIGenerated;
        const aiLicense = lastAIResult.licenseRecommendation.primary;
        // Force Commercial Remix path
        setSelectedPilType('commercial_remix');
        // Defaults per request
        if (isHuman) {
          setSelectedRevShare(10);
          setSelectedLicensePrice(10);
        } else {
          setSelectedRevShare(lastAIResult.licenseRecommendation.suggestedTerms.commercialRevShare || 0);
          setSelectedLicensePrice(lastAIResult.licenseRecommendation.suggestedTerms.mintingFee || 0);
        }
        setSelectedAiLearning(isHuman);

        const minForCustom = Number.parseInt(process.env.NEXT_PUBLIC_CUSTOM_LICENSE_MIN || '80', 10);
        const allowCustom = lastAIResult.ipEligibility.score >= minForCustom || isHuman;
        const st = lastAIResult.licenseRecommendation.suggestedTerms;

        // Build message text as requested
        const header = 'Superlee recommendation applied 🎉';
        const humanLine = isHuman ? '✅ Human content detected' : '🤖 AI content detected';
        const core = `License: Commercial Remix\nCommercial use: Yes\nDerivatives: Yes`;
        const msg = `${header}\n\n${humanLine}\n\n${core}`;

        try { chatAgent.updateLastMessage({ buttons: [] }); } catch {}
        const inlineButtons = [
          t("buttons.continue")
        ];
        chatAgent.addCompleteMessage({
          role: 'agent',
          text: msg,
          ts: Date.now(),
          buttons: inlineButtons,
          controls: {
            aiLearning: isHuman,
            mintingFee: isHuman ? 10 : (st.mintingFee || 0),
            revShare: isHuman ? 10 : (st.commercialRevShare || 0),
            aiLocked: !isHuman,
            editable: true,
          }
        });
        setToast(t("toasts.aiApplied"));
        setSmartApplied(true);
      } else {
        setToast(t("toasts.noAI"));
      }
    } else if (buttonText === "Why?") {
      if (lastAIResult && lastAIRec) {
        const aiStatus = lastAIResult.aiDetection.isAIGenerated ? `AI-Generated (${Math.round(lastAIResult.aiDetection.confidence * 100)}%)` : 'Human-Created';
        const qualityScore = `${lastAIResult.qualityAssessment.overall}/10`;
        const ipScore = `${lastAIResult.ipEligibility.score}/100`;
        const riskLevel = lastAIResult.ipEligibility.score >= 80 ? 'Low' : lastAIResult.ipEligibility.score >= 60 ? 'Medium' : 'High';
        const tolerance = lastAIResult.ipEligibility.isEligible ? 'Good to register' : 'Proceed with caution';
        const licenseText = lastAIResult.aiDetection.isAIGenerated ? lastAIRec.license : 'Commercial Remix - Standard terms';
        const details = `${t("details.title")}\n${t("details.ai")}: ${aiStatus}\n${t("details.quality")}: ${qualityScore}\n${t("details.ip")}: ${ipScore} - ${lastAIResult.ipEligibility.isEligible ? 'eligible' : 'not eligible'}\n${t("details.license")}: ${licenseText}\n${t("details.risk")}: ${riskLevel}\n${t("details.suggestion")}: ${tolerance}`;
        chatAgent.addMessage("agent", details);
      } else {
        chatAgent.addMessage("agent", t("generic.noMoreDetails"));
      }
    } else if (buttonText === t("buttons.continue") || buttonText === "Continue Registration") {
      chatAgent.processPrompt(buttonText, (referenceFile || analyzedFile) || undefined);
    } else if (buttonText === 'AI Learning On') {
      setSelectedAiLearning(true);
      chatAgent.addMessage('agent', 'AI Learning set to ON', [t("buttons.continue"), 'Edit Mint Fee', 'Edit Rev Share', 'AI Learning Off']);
    } else if (buttonText === 'AI Learning Off') {
      setSelectedAiLearning(false);
      chatAgent.addMessage('agent', 'AI Learning set to OFF', [t("buttons.continue"), 'Edit Mint Fee', 'Edit Rev Share', 'AI Learning On']);
    } else if (buttonText === 'Edit Mint Fee') {
      const v = Number(prompt('Enter minting fee in $', String(selectedLicensePrice || 0)));
      if (!isNaN(v) && v >= 0) setSelectedLicensePrice(v);
      const fee = (!isNaN(v) && v >= 0) ? v : (selectedLicensePrice || 0);
      chatAgent.addMessage('agent', `Minting fee set to $${fee}`, [t("buttons.continue"), 'AI Learning On', 'AI Learning Off', 'Edit Rev Share']);
    } else if (buttonText === 'Edit Rev Share') {
      const v = Number(prompt('Enter revenue share (%)', String(selectedRevShare || 10)));
      if (!isNaN(v) && v >= 0 && v <= 100) setSelectedRevShare(v);
      const rs = (!isNaN(v) && v >= 0 && v <= 100) ? v : (selectedRevShare || 10);
      chatAgent.addMessage('agent', `Revenue share set to ${rs}%`, [t("buttons.continue"), 'AI Learning On', 'AI Learning Off', 'Edit Mint Fee']);
    } else if (buttonText === t("buttons.customLicense") || buttonText === "Custom License" || buttonText === "🎯 Smart License") {
      setSmartApplied(false);
      setShowCustomLicense(true);
    } else if (buttonText === "Take Photo") {
      if (!referenceFile && analyzedFile) setReferenceFile(analyzedFile);
      setAwaitingIdentity(true);
      setShowCamera(true);
    } else if (buttonText === "Submit for Review") {
      setShowManualReview(true);
    } else if (buttonText === "Browse IP") {
      try { router.push('/dashboard'); } catch {}
    } else if (buttonText === "Copy dHash") {
      if (lastDHash) {
        navigator.clipboard.writeText(lastDHash).then(() => {
          setToast("dHash copied ✅");
        }).catch(() => setToast("Copy failed ❌"));
      } else {
        setToast("No dHash available ❌");
      }
    } else {
      chatAgent.processPrompt(buttonText);
    }
  }, [chatAgent, analyzedFile, lastDHash, analysis, recommendation]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      fileUpload.handleFileSelect(file);
      // Reset input for re-selection of same file
      event.target.value = '';
    }
  }, [fileUpload]);

  const verifyIdentityPhoto = useCallback(async (capture: File) => {
    if (!referenceFile) return;
    try {
      chatAgent.updateStatus('Verifying identity with camera photo...');

      // Multi-face check on capture
      try {
        const faces = await countFaces(capture);
        if (faces > 1) {
          setToast('Multiple faces detected ❌');
          chatAgent.addMessage('agent', 'Multiple faces detected in the photo. Please retake with only one face clearly visible.', ['Take Photo', 'Submit for Review']);
          return;
        }
      } catch {}

      // Embedding comparison (primary)
      const [refEmb, capEmb] = await Promise.all([
        getFaceEmbedding(referenceFile),
        getFaceEmbedding(capture)
      ]);

      const simTh = parseFloat(process.env.NEXT_PUBLIC_FACE_SIM_THRESHOLD || '0.82');

      if (refEmb && capEmb) {
        const sim = cosineSimilarity(refEmb, capEmb);
        if (sim >= simTh) {
          setAwaitingIdentity(false);
          setToast('Identity verified ✅');
          chatAgent.addMessage('agent', `Identity verified (similarity ${sim.toFixed(3)} ≥ ${simTh}). Proceeding to registration.`);
          chatAgent.processPrompt('Continue Registration', referenceFile);
          return;
        }
        setToast('Identity mismatch ❌');
        chatAgent.addMessage('agent', `Identity check failed (similarity ${sim.toFixed(3)} < ${simTh}). Please retake photo or upload proof.`);
        chatAgent.addMessage('agent', 'You can take another photo or submit for review.', ['Take Photo', 'Submit for Review']);
        return;
      }

      // Fallback: perceptual dHash if face embedding not available
      const hashSize = Number.parseInt(process.env.NEXT_PUBLIC_SAFE_IMAGE_DHASH_SIZE || '8', 10);
      const cropEnv = parseFloat(process.env.NEXT_PUBLIC_SAFE_IMAGE_CENTER_CROP || '0.7');
      const crop = Math.max(0.4, Math.min(0.95, isNaN(cropEnv) ? 0.7 : cropEnv));

      const refBase = await computeDHash(referenceFile, hashSize, false, 1);
      const refFlip = await computeDHash(referenceFile, hashSize, true, 1);
      const refCenter = await computeDHash(referenceFile, hashSize, false, crop);
      const refCenterFlip = await computeDHash(referenceFile, hashSize, true, crop);

      const capBase = await computeDHash(capture, hashSize, false, 1);
      const capFlip = await computeDHash(capture, hashSize, true, 1);
      const capCenter = await computeDHash(capture, hashSize, false, crop);
      const capCenterFlip = await computeDHash(capture, hashSize, true, crop);

      const refs = [refBase, refFlip, refCenter, refCenterFlip];
      const caps = [capBase, capFlip, capCenter, capCenterFlip];
      const hDist = (a: string, b: string) => {
        const len = Math.min(a.length, b.length);
        let dist = 0;
        for (let i = 0; i < len; i++) {
          const x = (parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 0xf;
          dist += [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4][x];
        }
        dist += Math.abs(a.length - b.length) * 4;
        return dist;
      };
      let best = Infinity;
      for (const r of refs) for (const c of caps) best = Math.min(best, hDist(r, c));

      const th = Number.parseInt(process.env.NEXT_PUBLIC_IDENTITY_DHASH_THRESHOLD || '14', 10);
      if (best <= th) {
        setAwaitingIdentity(false);
        setToast('Identity verified ✅');
        chatAgent.addMessage('agent', `Identity verified (distance ${best} ≤ ${th}). Proceeding to registration.`);
        chatAgent.processPrompt('Continue Registration', referenceFile);
      } else {
        setToast('Identity mismatch ❌');
        chatAgent.addMessage('agent', `Identity check failed (distance ${best} > ${th}). Please retake photo or upload proof.`);
        chatAgent.addMessage('agent', 'You can take another photo or submit for review.', ['Take Photo', 'Submit for Review']);
      }
    } catch (e) {
      setToast('Identity check error ❌');
      chatAgent.addMessage('agent', 'Identity verification encountered an error. Please try again.');
    }
  }, [referenceFile, chatAgent]);

  return (
    <div className="mx-auto max-w-[1400px] px-2 sm:px-4 md:px-6 overflow-x-hidden">
      <div className="flex flex-col lg:grid lg:grid-cols-[180px,1fr] gap-3 lg:gap-6 h-[calc(100vh-120px)] lg:h-[calc(100vh-180px)]">
        {/* History Sidebar - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:block">
          <HistorySidebar
            messages={chatAgent.messages}
            onNewChat={handleNewChat}
            chatHistory={chatAgent.history?.map(h => ({ id: h.id, title: h.title, lastMessage: h.lastMessage, timestamp: h.timestamp, messageCount: h.messageCount }))}
            onOpenSession={handleOpenSession}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Header */}
          <div className="shrink-0 mb-3 lg:mb-4 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 bg-white/10">
            <div className="flex items-center justify-between rounded-xl border border-white/10 p-3 lg:p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg">
                  <span className="text-lg font-bold text-white">S</span>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">CHAT WITH SUPERLEE</div>
                  </div>
                  <AIStatusIndicator />
                </div>
              </div>

              {/* Mobile menu button for history */}
              <button
                onClick={handleNewChat}
                className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
                title="New Chat"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <section className="flex-1 rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex flex-col min-h-0">
            {/* Messages Area */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto scrollbar-invisible"
            >
              <div className="mx-auto w-full max-w-[900px] px-2 sm:px-3 lg:px-4 py-3 lg:py-4">
                <MessageList
                  messages={chatAgent.messages}
                  onButtonClick={handleButtonClick}
                  onControlChange={(changes) => {
                    // Update local state
                    if (typeof changes.aiLearning === 'boolean' && !(lastAIResult?.aiDetection.isAIGenerated)) {
                      setSelectedAiLearning(changes.aiLearning);
                    }
                    if (typeof changes.mintingFee === 'number' && changes.mintingFee >= 0) {
                      setSelectedLicensePrice(changes.mintingFee);
                    }
                    if (typeof changes.revShare === 'number' && changes.revShare >= 0 && changes.revShare <= 100) {
                      setSelectedRevShare(changes.revShare);
                    }
                    // Reflect in last chat message controls
                    chatAgent.updateLastMessage({
                      controls: {
                        aiLearning: (typeof changes.aiLearning === 'boolean') ? changes.aiLearning : (!!selectedAiLearning && !(lastAIResult?.aiDetection.isAIGenerated)),
                        mintingFee: (typeof changes.mintingFee === 'number') ? changes.mintingFee : (selectedLicensePrice || 0),
                        revShare: (typeof changes.revShare === 'number') ? changes.revShare : (selectedRevShare || 0),
                        aiLocked: !!lastAIResult?.aiDetection.isAIGenerated,
                        editable: true,
                      }
                    });
                  }}
                  isTyping={chatAgent.isTyping}
                />


                {/* Plan Box */}
                {chatAgent.currentPlan && (() => {
                  const base = chatAgent.currentPlan;
                  const steps = [...base.steps];
                  const idx = steps.findIndex(s => /^License:/i.test(s) || /^Lisensi:/i.test(s));
                  let label = selectedPilType === 'open_use' ? 'Open Use' : 'Commercial Remix';
                  if (smartApplied && lastAIResult?.licenseRecommendation.primary === 'remix') label = 'Remix License';
                  if (smartApplied && lastAIResult?.licenseRecommendation.primary === 'nonCommercial') label = 'Non-Commercial';
                  const line = /^Lisensi:/i.test(steps[idx] || '') ? `Lisensi: ${label}` : `License: ${label}`;
                  if (idx >= 0) steps[idx] = line; else steps.push(line);
                  const planToShow = { ...base, steps } as typeof base;
                  return (
                    <PlanBox
                      plan={planToShow}
                      onConfirm={executePlan}
                      onCancel={chatAgent.clearPlan}
                      registerState={registerAgent.registerState}
                      selectedPilType={selectedPilType}
                      selectedRevShare={selectedRevShare}
                      selectedLicensePrice={selectedLicensePrice}
                      selectedAiLearning={selectedAiLearning}
                      aiContent={!!lastAIResult?.aiDetection.isAIGenerated}
                      hideLicenseControls={(!!customTerms) || (smartApplied && !!lastAIResult?.aiDetection.isAIGenerated)}
                      onLicenseChange={({ pilType, revShare, licensePrice, aiLearning }) => {
                        if (pilType) setSelectedPilType(pilType);
                        if (typeof revShare === 'number') setSelectedRevShare(revShare);
                        if (typeof licensePrice === 'number') setSelectedLicensePrice(licensePrice);
                        if (typeof aiLearning === 'boolean') setSelectedAiLearning(aiLearning);
                      }}
                    />
                  );
                })()}
              </div>
            </div>

            {/* Composer */}
            <div className="shrink-0">
              <Composer
                onSubmit={(prompt) => chatAgent.processPrompt(prompt, fileUpload.file || undefined)}
                status={chatAgent.status}
                file={fileUpload.file}
                onFileSelect={fileUpload.handleFileSelect}
                onFileRemove={fileUpload.removeFile}
                previewUrl={fileUpload.previewUrl}
                isTyping={chatAgent.isTyping}
                awaitingInput={chatAgent.awaitingInput}
                messages={chatAgent.messages}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Smart License Wizard */}
      {showCustomLicense && (
        <SimpleLicenseWizard
          onLicenseSelect={(data) => {
            setCustomTerms(data.terms);
            setShowCustomLicense(false);
            chatAgent.addMessage('agent', `✨ **Smart License Created!**\n\n**${data.name}**\n${data.description}\n\nClick Continue Registration to proceed with your custom license.`);
            setToast("Smart license created ✅");
          }}
          onClose={() => setShowCustomLicense(false)}
        />
      )}

      {/* Camera Modal */}
      <CameraCapture
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(file) => {
          fileUpload.handleFileSelect(file);
          // verification will kick via useEffect when awaitingIdentity=true
        }}
        onFallback={() => {
          setShowCamera(false);
          cameraInputRef.current?.click();
        }}
      />

      {/* Toast Notifications */}
      <Toast
        message={toast}
        onClose={() => setToast(null)}
      />

      {/* Manual Review Modal */}
      <ManualReviewModal
        open={showManualReview}
        onClose={() => setShowManualReview(false)}
        onSubmitted={({ cid, url }) => {
          chatAgent.addCompleteMessage({
            role: 'agent',
            ts: Date.now(),
            text: `Permohonan review terkirim ✅\nCID: ${cid}`,
            links: [{ text: 'Lihat berkas review di IPFS', url }]
          });
          setToast('Review submitted ���');
        }}
      />
    </div>
  );
}
