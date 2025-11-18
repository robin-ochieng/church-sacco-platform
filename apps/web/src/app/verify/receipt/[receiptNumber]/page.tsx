'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useTransientToast } from '@/hooks/useTransientToast';

interface VerificationPayload {
  receiptNumber: string;
  memberName: string;
  memberNumber: string;
  amount: number;
  tellerEmail: string | null;
  status: string;
  valueDate: string;
  verificationUrl?: string;
  verifiedAt: string;
  channel?: string;
}

const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
});

const dateFormatter = new Intl.DateTimeFormat('en-KE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default function VerifyReceiptPage() {
  const params = useParams<{ receiptNumber: string }>();
  const receiptNumber = useMemo(() => (params?.receiptNumber as string) || '', [params]);
  const [payload, setPayload] = useState<VerificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const { toast, showToast } = useTransientToast();

  useEffect(() => {
    const fetchVerification = async () => {
      if (!receiptNumber) {
        setLoading(false);
        setError('Receipt number missing in the URL.');
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.get<VerificationPayload>(`/verify/receipt/${receiptNumber}`);
        setPayload(response.data);
        setError(null);
      } catch (err) {
        console.error('Receipt verification failed:', err);
        setError('Receipt not found or no longer valid.');
        setPayload(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [receiptNumber]);

  const handleCopyReceiptNumber = async () => {
    if (!receiptNumber) {
      return;
    }

    try {
      setCopying(true);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(receiptNumber);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = receiptNumber;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('Receipt number copied');
    } catch (err) {
      console.error('Failed to copy receipt number:', err);
      showToast('Unable to copy. Please try again.', 'error');
    } finally {
      setCopying(false);
    }
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="bg-white shadow rounded-lg p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 rounded" />
            <div className="h-6 bg-slate-200 rounded w-1/2" />
            <div className="h-48 bg-slate-100 rounded" />
          </div>
        </div>
      );
    }

    if (error || !payload) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-2">Receipt Not Verified</h2>
          <p className="mb-4">{error || 'Unable to locate that receipt.'}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Home
          </Link>
        </div>
      );
    }

    return (
      <div className="bg-white shadow rounded-lg p-8">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-slate-500">Receipt Number</p>
            <p className="text-3xl font-bold text-slate-900 tracking-wide">{payload.receiptNumber}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-500">Member</p>
              <p className="text-lg font-semibold text-slate-900">
                {payload.memberName} • {payload.memberNumber}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-500">Amount</p>
              <p className="text-lg font-semibold text-slate-900">
                {currencyFormatter.format(payload.amount)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <span className="inline-flex items-center mt-1 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700">
                {payload.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Channel</p>
              <p className="text-base font-medium text-slate-900">{payload.channel || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Teller</p>
              <p className="text-base font-medium text-slate-900">{payload.tellerEmail || 'System Generated'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Value Date</p>
              <p className="text-base font-medium text-slate-900">
                {payload.valueDate ? dateFormatter.format(new Date(payload.valueDate)) : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Verified</p>
              <p className="text-base font-medium text-slate-900">
                {payload.verifiedAt ? dateFormatter.format(new Date(payload.verifiedAt)) : '—'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCopyReceiptNumber}
              disabled={copying}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {copying ? 'Copying…' : 'Copy Receipt Number'}
            </button>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Verify Teller Receipt</h1>
          <p className="text-slate-600 mt-2">
            Paste or scan a receipt number to confirm that it was issued by ACK Thiboro SACCO.
          </p>
        </div>
        {renderBody()}
      </div>

      {toast && (
        <div
          className={`fixed bottom-8 right-8 rounded-md shadow-lg px-4 py-3 text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
