import type { RegisterIntent } from "@/lib/agent/engine";

// Message types for chat
export type Message = {
  role: "you" | "agent";
  text: string;
  ts: number;
  buttons?: string[];
  image?: {
    url: string;
    alt?: string;
  };
  links?: {
    text: string;
    url: string;
  }[];
  isLoading?: boolean;
  controls?: {
    aiLearning?: boolean;
    mintingFee?: number;
    revShare?: number;
    aiLocked?: boolean; // when true, aiLearning toggle disabled
    editable?: boolean; // when false, inputs disabled
  };
};

// Plan types
export type Plan = {
  type: "register";
  steps: string[];
  intent: RegisterIntent;
};


// Register IP agent state
export type RegisterState = {
  status: 'idle' | 'compressing' | 'uploading-image' | 'creating-metadata' | 'uploading-metadata' | 'minting' | 'success' | 'error';
  progress: number;
  error: any | null;
  ipId?: string;
  txHash?: string;
};

// File upload state
export type FileUploadState = {
  file: File | null;
  previewUrl: string | null;
  uploading: boolean;
};

// Chat agent state
export type ChatState = {
  messages: Message[];
  currentPlan: Plan | null;
  status: string;
};
