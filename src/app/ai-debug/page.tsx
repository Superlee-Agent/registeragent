"use client";

import React, { useState, useEffect } from "react";
import { Brain, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface HealthStatus {
  status: string;
  message: string;
  checks: {
    apiKeyConfigured: boolean;
    openaiConnection: boolean;
    modelAccess: boolean;
  };
  error?: string;
  testResponse?: string;
}

export default function AIDebugPage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/health');
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      setHealthStatus({
        status: "error",
        message: "Failed to reach health endpoint",
        checks: {
          apiKeyConfigured: false,
          openaiConnection: false,
          modelAccess: false
        },
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setLoading(false);
    }
  };

  const testAnalysis = async () => {
    if (!testImage) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/ai/analyze-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: testImage.split(',')[1] })
      });
      
      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      setAnalysisResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTestImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const StatusIcon = ({ status }: { status: boolean }) => 
    status ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />;

  return (
    <div className="min-h-screen bg-ai-bg p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Brain className="h-8 w-8 text-ai-primary" />
            <h1 className="text-3xl font-bold text-white">AI Detection Debug</h1>
          </div>
          <p className="text-white/70">
            Troubleshoot and test the AI detection system
          </p>
        </div>

        {/* Health Status */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              System Health
            </h2>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ai-primary/20 text-ai-primary hover:bg-ai-primary/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {healthStatus ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${
                healthStatus.status === 'healthy' ? 'bg-green-500/10 border-green-500/20' :
                'bg-red-500/10 border-red-500/20'
              }`}>
                <p className={`font-medium ${
                  healthStatus.status === 'healthy' ? 'text-green-300' : 'text-red-300'
                }`}>
                  {healthStatus.message}
                </p>
                {healthStatus.error && (
                  <p className="text-red-200 text-sm mt-2">{healthStatus.error}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                  <StatusIcon status={healthStatus.checks.apiKeyConfigured} />
                  <span className="text-sm text-white/80">API Key Configured</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                  <StatusIcon status={healthStatus.checks.openaiConnection} />
                  <span className="text-sm text-white/80">OpenAI Connection</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                  <StatusIcon status={healthStatus.checks.modelAccess} />
                  <span className="text-sm text-white/80">Model Access</span>
                </div>
              </div>

              {healthStatus.testResponse && (
                <div className="p-3 rounded-lg bg-black/20">
                  <p className="text-xs text-white/60">Test Response:</p>
                  <p className="text-sm text-white/80">{healthStatus.testResponse}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-white/60">Loading health status...</div>
          )}
        </div>

        {/* Test Analysis */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-ai-primary" />
            Test Analysis
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Upload Test Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-ai-primary/20 file:text-ai-primary hover:file:bg-ai-primary/30"
              />
            </div>

            {testImage && (
              <div className="space-y-4">
                <img
                  src={testImage}
                  alt="Test"
                  className="max-w-xs rounded-lg border border-white/20"
                />
                <button
                  onClick={testAnalysis}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-ai-primary hover:bg-ai-primary/80 text-white transition-colors disabled:opacity-50"
                >
                  {loading ? 'Analyzing...' : 'Test AI Analysis'}
                </button>
              </div>
            )}

            {analysisResult && (
              <div className="p-4 rounded-lg bg-black/30 border border-white/10">
                <h3 className="font-medium text-white mb-2">Analysis Result:</h3>
                <pre className="text-xs text-white/70 overflow-auto">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Troubleshooting Guide */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Troubleshooting Guide</h2>
          
          <div className="space-y-4 text-sm text-white/80">
            <div>
              <h3 className="font-medium text-white mb-2">❌ API Key Not Configured</h3>
              <p>Set the OPENAI_API_KEY environment variable:</p>
              <code className="block mt-1 p-2 bg-black/40 rounded text-xs">
                OPENAI_API_KEY=sk-your-api-key-here
              </code>
            </div>

            <div>
              <h3 className="font-medium text-white mb-2">❌ OpenAI Connection Failed</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Check if API key is valid</li>
                <li>Verify network connectivity</li>
                <li>Check if OpenAI services are down</li>
                <li>Ensure proper billing setup on OpenAI account</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-white mb-2">❌ Model Access Failed</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>gpt-4o model requires OpenAI API access</li>
                <li>Check your OpenAI account tier and limits</li>
                <li>Verify you have vision API access</li>
                <li>Check rate limits and quotas</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-white mb-2">⚠️ Analysis Unavailable</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>System will use fallback basic analysis</li>
                <li>Some features will be limited</li>
                <li>Fix the above issues to enable full AI detection</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
