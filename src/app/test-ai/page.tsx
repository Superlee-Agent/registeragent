"use client";

import React, { useState } from "react";
import { 
  parseCommandWithAI, 
  generateContextualResponse, 
  getOpenAIStatus, 
  isOpenAIAvailable 
} from "@/lib/openai";
import { AIStatusIndicator } from "@/components/AIStatusIndicator";

export default function TestAI() {
  const [testMessage, setTestMessage] = useState("register this image as IP");
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [contextualResponse, setContextualResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);

  React.useEffect(() => {
    setStatus(getOpenAIStatus());
  }, []);

  const testCommandParsing = async () => {
    setLoading(true);
    try {
      const result = await parseCommandWithAI(testMessage);
      setAiResponse(result);
    } catch (error) {
      setAiResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testContextualResponse = async () => {
    setLoading(true);
    try {
      const result = await generateContextualResponse(
        testMessage,
        "User is testing AI capabilities",
        "test"
      );
      setContextualResponse(result);
    } catch (error) {
      setContextualResponse(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ai-bg via-purple-900/20 to-ai-bg p-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">OpenAI Integration Test</h1>
          <AIStatusIndicator className="mx-auto" />
        </div>

        {/* Status Overview */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-white/70 mb-1">OpenAI Available</div>
              <div className={`text-lg font-medium ${isOpenAIAvailable() ? 'text-green-400' : 'text-red-400'}`}>
                {isOpenAIAvailable() ? '✅ Yes' : '❌ No'}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/70 mb-1">Status</div>
              <div className="text-lg font-medium text-white">
                {status?.available ? 'Connected' : `Error: ${status?.error || 'Unknown'}`}
              </div>
            </div>
          </div>
        </div>

        {/* Test Input */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test AI Command Parsing</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Test Message</label>
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-ai-primary"
                placeholder="Enter a command to test..."
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={testCommandParsing}
                disabled={loading || !isOpenAIAvailable()}
                className="px-4 py-2 bg-ai-primary hover:bg-ai-primary/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? 'Testing...' : 'Test Command Parsing'}
              </button>
              
              <button
                onClick={testContextualResponse}
                disabled={loading || !isOpenAIAvailable()}
                className="px-4 py-2 bg-ai-accent hover:bg-ai-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? 'Testing...' : 'Test Contextual Response'}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {aiResponse && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Command Parsing Result</h3>
            <pre className="bg-black/30 p-4 rounded-lg overflow-auto text-sm text-green-300">
              {JSON.stringify(aiResponse, null, 2)}
            </pre>
          </div>
        )}

        {contextualResponse && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Contextual Response Result</h3>
            <div className="bg-black/30 p-4 rounded-lg text-white">
              {contextualResponse}
            </div>
          </div>
        )}

        {/* Setup Instructions */}
        {!isOpenAIAvailable() && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-yellow-300 mb-3">Setup Required</h3>
            <div className="text-yellow-200 space-y-2">
              <p>OpenAI is not configured. To enable AI features:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Get an OpenAI API key from <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-yellow-400 underline">platform.openai.com</a></li>
                <li>Set the environment variable: <code className="bg-black/30 px-2 py-1 rounded">OPENAI_API_KEY=your_key_here</code></li>
                <li>Restart the development server</li>
              </ol>
              <p className="text-sm mt-4">See <code>docs/OPENAI_SETUP.md</code> for detailed instructions.</p>
            </div>
          </div>
        )}

        {/* Example Commands */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Example Commands to Test</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-white mb-2">Register Commands</h4>
              <ul className="space-y-1 text-sm text-white/70">
                <li>• "register this image as IP"</li>
                <li>• "mint my artwork as NFT"</li>
                <li>• "create IP for my photo"</li>
                <li>• "I want to register my art"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Helpful context</h4>
              <ul className="space-y-1 text-sm text-white/70">
                <li>• "help"</li>
                <li>• "what license should I choose"</li>
                <li>• "explain commercial remix"</li>
                <li>• "analyze my image"</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
