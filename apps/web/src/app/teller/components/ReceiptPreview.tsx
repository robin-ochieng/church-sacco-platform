'use client';

import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { buildDownloadFilename, saveBlob } from '@/lib/download';
import { useTransientToast } from '@/hooks/useTransientToast';
import { Transaction } from '../types';

interface ReceiptPreviewProps {
  transaction: Transaction;
  onNewDeposit: () => void;
}

const getAppOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

export default function ReceiptPreview({ transaction, onNewDeposit }: ReceiptPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const { toast, showToast } = useTransientToast();

  const verificationUrl = useMemo(() => {
    if (!transaction.receiptNumber) {
      return '';
    }
    const origin = (process.env.NEXT_PUBLIC_APP_URL || getAppOrigin()).replace(/\/$/, '');
    return `${origin}/verify/receipt/${transaction.receiptNumber}`;
  }, [transaction.receiptNumber]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateString));
  };

  const getChannelLabel = (channel: string) => {
    const labels: Record<string, string> = {
      CASH: 'Cash',
      MOBILE_MONEY: 'Mobile Money',
      BANK_TRANSFER: 'Bank Transfer',
      CHEQUE: 'Cheque',
    };
    return labels[channel] || channel;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SAVINGS_DEPOSIT: 'Savings Deposit',
      SHARES_DEPOSIT: 'Shares Deposit',
      SPECIAL_CONTRIBUTION: 'Special Contribution',
    };
    return labels[type] || type;
  };

  const handleDownloadPdf = async () => {
    if (!transaction.receiptNumber) {
      showToast('Receipt number missing for this transaction.', 'error');
      return;
    }

    try {
      setIsDownloading(true);
      const response = await apiClient.get<Blob>(`/receipts/transaction/${transaction.receiptNumber}.pdf`, {
        responseType: 'blob',
        headers: { Accept: 'application/pdf' },
      });
      const filename = buildDownloadFilename('receipt', transaction.receiptNumber);
      saveBlob(response.data, filename);
      showToast('Receipt PDF download started');
    } catch (error) {
      console.error('Failed to download teller receipt:', error);
      showToast('Unable to download PDF. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!verificationUrl) {
      showToast('Verification link is unavailable.', 'error');
      return;
    }

    try {
      setIsCopying(true);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(verificationUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = verificationUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('Verification link copied');
    } catch (error) {
      console.error('Failed to copy verification link:', error);
      showToast('Unable to copy link. Please try again.', 'error');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Success Header */}
      <div className="bg-green-50 border-b border-green-200 p-6">
        <div className="flex items-center justify-center mb-2">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-green-900">
          Deposit Successful!
        </h2>
        <p className="text-center text-green-700 mt-1">
          Transaction has been recorded and receipt generated
        </p>
      </div>

      {/* Receipt Content */}
      <div className="p-8" id="receipt-content">
        {/* Receipt Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            ACK Thiboro SACCO
          </h3>
          <p className="text-sm text-gray-600">Official Deposit Receipt</p>
        </div>

        {/* Receipt Number - Prominent Display */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 text-center">
          <p className="text-sm font-medium text-blue-800 mb-1">Receipt Number</p>
          <p className="text-3xl font-bold text-blue-900 tracking-wide">
            {transaction.receiptNumber}
          </p>
        </div>

        {/* Transaction Details */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Member Name</p>
              <p className="font-semibold text-gray-900">{transaction.member.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Member Number</p>
              <p className="font-semibold text-gray-900">{transaction.member.memberNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Transaction Type</p>
              <p className="font-semibold text-gray-900">{getTypeLabel(transaction.type)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Channel</p>
              <p className="font-semibold text-gray-900">{getChannelLabel(transaction.channel)}</p>
            </div>
          </div>

          {transaction.reference && (
            <div>
              <p className="text-sm text-gray-600">Reference Number</p>
              <p className="font-semibold text-gray-900">{transaction.reference}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Transaction Date</p>
              <p className="font-semibold text-gray-900">{formatDateTime(transaction.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                {transaction.status}
              </p>
            </div>
          </div>

          {transaction.narration && (
            <div>
              <p className="text-sm text-gray-600">Narration</p>
              <p className="font-medium text-gray-900">{transaction.narration}</p>
            </div>
          )}
        </div>

        {/* Amount Section */}
        <div className="border-t-2 border-gray-200 pt-6 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-lg font-medium text-gray-700">Deposit Amount:</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(transaction.amount)}
            </p>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <p className="text-lg font-medium text-gray-700">New Balance:</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(transaction.balanceAfter)}
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            This is a computer-generated receipt and does not require a signature.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            For inquiries, please contact the SACCO office.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-gray-50 px-8 py-6 flex flex-col gap-3 lg:flex-row lg:space-x-4 print:hidden">
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg
            className={`w-5 h-5 mr-2 ${isDownloading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v11m0 0l-4-4m4 4l4-4M5 19h14"
            />
          </svg>
          {isDownloading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <button
          onClick={handleCopyLink}
          disabled={isCopying || !verificationUrl}
          className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg
            className={`w-5 h-5 mr-2 ${isCopying ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 8a3 3 0 013 3v6a3 3 0 01-3 3H9a3 3 0 01-3-3v-6a3 3 0 013-3h6zm0-3H9a3 3 0 00-3 3v1h2V8a1 1 0 011-1h6a1 1 0 011 1v1h2V8a3 3 0 00-3-3z"
            />
          </svg>
          {isCopying ? 'Copying…' : 'Copy Verification Link'}
        </button>
        <button
          onClick={onNewDeposit}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Deposit
        </button>
      </div>

      {toast && (
        <div
          className={`fixed bottom-8 right-8 rounded-md shadow-lg px-4 py-3 text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-content,
          #receipt-content * {
            visibility: visible;
          }
          #receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
