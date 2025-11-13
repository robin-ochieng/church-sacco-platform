'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HealthStatus {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
}

type ApiStatus = 'loading' | 'success' | 'error';

export default function HealthPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          setHealthData(data);
          setApiStatus('success');
        } else {
          setError(`API returned status ${response.status}`);
          setApiStatus('error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to API');
        setApiStatus('error');
      }
    };

    checkHealth();
  }, []);

  const getStatusBadge = () => {
    if (apiStatus === 'loading') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <span className="animate-pulse">Checking...</span>
        </span>
      );
    }

    if (apiStatus === 'success') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          API status: ok
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        API status: error
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">API Health Check</h1>
            <p className="text-blue-100 text-sm">
              Real-time status of the backend API
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Connection Status
                </h2>
                {getStatusBadge()}
              </div>

              {/* Health Data */}
              {apiStatus === 'success' && healthData && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Service:</span>
                    <span className="text-sm text-gray-900">{healthData.service}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="text-sm text-gray-900">{healthData.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Timestamp:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(healthData.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {apiStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-800 mb-2">
                    Connection Error
                  </h3>
                  <p className="text-sm text-red-700">{error}</p>
                  <p className="text-xs text-red-600 mt-2">
                    Make sure the API server is running at{' '}
                    {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
                  </p>
                </div>
              )}

              {/* API Endpoint Info */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  API Configuration
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <code className="text-xs text-gray-700 break-all">
                    {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/health
                  </code>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Refresh Status
                </button>
                <Link
                  href="/auth/sign-in"
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors text-center"
                >
                  Go to Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>This page verifies the connection between the web frontend and the API backend.</p>
        </div>
      </div>
    </div>
  );
}
