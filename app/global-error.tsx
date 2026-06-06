"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h1 className="text-lg font-bold text-red-600">Something went wrong</h1>
          <p className="text-sm text-gray-600">
            {error.message || "An unexpected server error occurred."}
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 font-mono">Digest: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
