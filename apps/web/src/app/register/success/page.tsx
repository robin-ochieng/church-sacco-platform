'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const memberNumber = searchParams.get('memberNumber');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Success Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Success Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <svg
              className="h-10 w-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your member account has been created successfully.
          </p>

          {/* Member Number */}
          {memberNumber && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Your Member Number</p>
              <p className="text-2xl font-bold text-blue-600">{memberNumber}</p>
              <p className="text-xs text-gray-500 mt-2">
                Please save this number for your records
              </p>
            </div>
          )}

          {/* Next Steps */}
          <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Next Steps:</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>Check your email for a verification link</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>Verify your email address to activate your account</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span>Sign in with your email and password</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                <span>Complete your profile and start using the platform</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <a
              href="/login"
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Go to Login
            </a>
            <a
              href="/"
              className="block w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
            >
              Back to Home
            </a>
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Having issues?{' '}
            <a href="/contact" className="text-blue-600 hover:underline font-medium">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
