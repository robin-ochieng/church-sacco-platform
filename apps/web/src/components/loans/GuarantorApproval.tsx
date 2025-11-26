'use client';

import { useState } from 'react';
import axios from 'axios';

interface GuarantorApprovalProps {
  loanId: string;
  guarantorId: string;
  loanDetails: {
    loanNumber: string;
    borrowerName: string;
    loanAmount: number;
    amountGuaranteed: number;
  };
  onApprovalComplete: () => void;
  apiUrl?: string;
}

export function GuarantorApproval({
  loanId,
  guarantorId,
  loanDetails,
  onApprovalComplete,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
}: GuarantorApprovalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [signatureKey, setSignatureKey] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const handleApprove = async () => {
    if (!hasAgreed) {
      setError('You must agree to the terms before approving');
      return;
    }

    if (!signatureKey) {
      setError('Please provide your signature');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await axios.patch(
        `${apiUrl}/loans/${loanId}/guarantors/${guarantorId}/approve`,
        {
          action: 'APPROVE',
          signatureKey,
        }
      );
      onApprovalComplete();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve guarantee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      setError('Please provide a reason for declining');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await axios.patch(
        `${apiUrl}/loans/${loanId}/guarantors/${guarantorId}/approve`,
        {
          action: 'DECLINE',
          declineReason,
        }
      );
      onApprovalComplete();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to decline guarantee');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simple signature placeholder (in production, use canvas-based signature component)
  const handleSignature = () => {
    // Generate a mock signature key for demo
    // In production, this would be handled by a signature pad component
    setSignatureKey(`sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Guarantee Request</h2>

      {/* Loan Details */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Loan Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Loan Number:</span>
            <span className="font-medium">{loanDetails.loanNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Borrower:</span>
            <span className="font-medium">{loanDetails.borrowerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Loan Amount:</span>
            <span className="font-medium">{formatCurrency(loanDetails.loanAmount)}</span>
          </div>
          <div className="flex justify-between text-blue-800">
            <span className="font-medium">Your Guarantee Amount:</span>
            <span className="font-bold">{formatCurrency(loanDetails.amountGuaranteed)}</span>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-yellow-800 mb-2">Important Notice</h3>
        <p className="text-sm text-yellow-700 mb-3">
          By approving this guarantee, you agree to:
        </p>
        <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
          <li>Be liable for the guaranteed amount if the borrower defaults</li>
          <li>Allow the SACCO to recover the guaranteed amount from your shares if necessary</li>
          <li>This guarantee cannot be revoked once approved</li>
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!showDeclineForm ? (
        <>
          {/* Agreement Checkbox */}
          <div className="mb-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                I have read and understood the terms above. I agree to guarantee this loan.
              </span>
            </label>
          </div>

          {/* Signature Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Digital Signature
            </label>
            {signatureKey ? (
              <div className="border border-green-300 bg-green-50 rounded-lg p-4 text-center">
                <span className="text-green-700">✓ Signature captured</span>
                <button
                  onClick={() => setSignatureKey(null)}
                  className="ml-2 text-sm text-gray-500 underline"
                >
                  Clear
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignature}
                className="w-full border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 hover:border-indigo-300 hover:bg-indigo-50"
              >
                Click to add your signature
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isSubmitting || !hasAgreed || !signatureKey}
              className="flex-1 py-2 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'Approve Guarantee'}
            </button>
            <button
              onClick={() => setShowDeclineForm(true)}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-red-100 text-red-700 rounded-md font-medium hover:bg-red-200"
            >
              Decline
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Decline Form */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Declining
            </label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Please provide a reason for declining this guarantee request..."
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={isSubmitting || !declineReason.trim()}
              className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 disabled:bg-gray-400"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Decline'}
            </button>
            <button
              onClick={() => {
                setShowDeclineForm(false);
                setDeclineReason('');
              }}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default GuarantorApproval;
