export default function GlobalError() {
  return (
    <html>
      <body>
        <div className="min-h-screen grid place-items-center p-6 text-white bg-ai-bg">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">500 — Server Error</h1>
            <p className="text-white/70">Something went wrong. Please try again later.</p>
          </div>
        </div>
      </body>
    </html>
  );
}
