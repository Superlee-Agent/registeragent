"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-white bg-ai-bg">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        {error?.message && <p className="text-white/70 text-sm">{error.message}</p>}
        <button onClick={() => reset()} className="px-4 py-2 rounded bg-ai-primary hover:bg-ai-primary/80">Try again</button>
      </div>
    </div>
  );
}
