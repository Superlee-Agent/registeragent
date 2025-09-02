import OpenAI from 'openai';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

// Centralized model selection
export function getChatModel(): string {
  const envModel = process.env.OPENAI_MODEL || process.env.OPENAI_CHAT_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL;
  return (envModel && envModel.trim()) || 'gpt-5';
}

function getOpenAIClient(): OpenAI | null {
  // Only create server-side client
  if (typeof window !== 'undefined') return null;
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    try {
      openaiClient = new OpenAI({ apiKey });
    } catch {
      return null;
    }
  }
  return openaiClient;
}

// Types for OpenAI responses
export interface AICommandParsing {
  intent: 'register' | 'unknown';
  confidence: number;
  extractedData: {
    title?: string;
    description?: string;
    license?: string;
  };
  naturalResponse: string;
}

export interface AIImageDescription {
  description: string;
  suggestedTitle: string;
  detectedObjects: string[];
  style?: string;
  mood?: string;
}

// Parse user command with natural language understanding
export async function parseCommandWithAI(message: string): Promise<AICommandParsing | null> {
  const client = getOpenAIClient();
  try {
    if (!client) {
      const r = await fetch('/api/ai/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
      const j = await r.json();
      if (j?.ok && j?.data) return j.data as AICommandParsing;
      return null;
    }
    const response = await client.chat.completions.create({
      model: getChatModel(),
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that parses user commands for a DeFi/IP platform. 
          
Users can:
1. REGISTER IP (examples: "register this image", "mint my artwork as NFT", "create IP for my photo")

Respond with a JSON object containing:
- intent: "register" | "unknown"
- confidence: 0-1 (how confident you are)
- extractedData: relevant data extracted from the message
- naturalResponse: a friendly response acknowledging what the user wants

For register commands, extract: title, description, license type if mentioned`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as AICommandParsing;
  } catch (error) {
    console.error('OpenAI command parsing error:', error);
    return null;
  }
}

// Generate smart conversational responses
export async function generateContextualResponse(
  userMessage: string,
  context: string,
  intent?: string
): Promise<string | null> {
  const client = getOpenAIClient();
  try {
    if (!client) {
      const r = await fetch('/api/ai/respond', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userMessage, context, intent }) });
      const j = await r.json();
      if (j?.ok && typeof j?.data === 'string') return j.data as string;
      return null;
    }
    const response = await client.chat.completions.create({
      model: getChatModel(),
      messages: [
        {
          role: 'system',
          content: `You are SuperLee, a friendly and helpful AI assistant for a DeFi/IP platform. 
          
Your personality:
- Casual and approachable (use Indonesian slang occasionally)
- Expert in crypto trading and IP registration
- Always helpful and encouraging
- Keep responses concise but warm

Context: ${context}
Intent: ${intent || 'general conversation'}

Respond naturally in a conversational way. If user needs clarification, ask specific questions.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI response generation error:', error);
    return null;
  }
}

// Analyze uploaded images for IP registration
export async function analyzeImageForIP(imageBase64: string): Promise<AIImageDescription | null> {
  const client = getOpenAIClient();
  try {
    if (!client) {
      const r = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageBase64 }) });
      const j = await r.json();
      if (j?.ok && j?.data) return j.data as AIImageDescription;
      return null;
    }
    const response = await client.chat.completions.create({
      model: getChatModel(),
      messages: [
        {
          role: 'system',
          content: `You are an AI that analyzes images for intellectual property registration. 
          
Provide a JSON response with:
- description: detailed description of the image (2-3 sentences)
- suggestedTitle: a catchy title for this artwork/photo
- detectedObjects: array of main objects/subjects in the image
- style: artistic style if applicable (photography, digital art, painting, etc.)
- mood: the mood/emotion conveyed by the image`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image for IP registration. Provide detailed insights that would help with metadata and description.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low'
              }
            }
          ]
        }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as AIImageDescription;
  } catch (error) {
    console.error('OpenAI image analysis error:', error);
    return null;
  }
}

// Convert image file to base64 for OpenAI Vision API
export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Check if OpenAI is available
export function isOpenAIAvailable(): boolean {
  // Heuristic: if running on server and key exists, or on client assume server endpoint is available
  if (typeof window === 'undefined') return !!process.env.OPENAI_API_KEY;
  return true;
}

// Get OpenAI status for debugging
export function getOpenAIStatus(): { available: boolean; error?: string } {
  const available = typeof window === 'undefined' ? !!process.env.OPENAI_API_KEY : true;
  return available ? { available: true } : { available: false, error: 'API key not configured' };
}
