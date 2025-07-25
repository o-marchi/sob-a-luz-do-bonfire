'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global Error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Application Error
            </h2>
            <div className="text-red-600 mb-4">
              {error.message || 'An unexpected error occurred'}
            </div>
            {error.digest && (
              <div className="text-sm text-red-500 mb-4">
                Error Code: {error.digest}
              </div>
            )}
            <button
              onClick={reset}
              className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}