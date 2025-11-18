'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get user data from localStorage
        const userDataString = localStorage.getItem('user');
        
        if (!userDataString) {
          throw new Error('No user data found');
        }

        const userData = JSON.parse(userDataString);
        const userRole = userData.user?.role || userData.role;
        
        if (!userRole) {
          throw new Error('User role not found');
        }
        
        setStatus('success');
        
        // Redirect based on user role
        setTimeout(() => {
          switch (userRole) {
            case 'ADMIN':
            case 'MANAGER':
              router.push('/admin');
              break;
            case 'TREASURER':
            case 'CLERK':
              router.push('/teller');
              break;
            case 'SECRETARY':
              router.push('/secretary');
              break;
            case 'CHAIRMAN':
              router.push('/chairman');
              break;
            case 'MEMBER':
            default:
              router.push('/member');
              break;
          }
        }, 1000);
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        // Clear invalid data
        localStorage.removeItem('user');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Authenticating...
            </h2>
            <p className="text-gray-600">Please wait while we sign you in.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="rounded-full h-16 w-16 bg-green-100 mx-auto flex items-center justify-center">
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
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Authentication Successful!
            </h2>
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="rounded-full h-16 w-16 bg-red-100 mx-auto flex items-center justify-center">
              <svg
                className="h-10 w-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Authentication Failed
            </h2>
            <p className="text-gray-600">
              There was an error processing your authentication.
            </p>
            <button
              onClick={() => router.push('/auth/sign-in')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
