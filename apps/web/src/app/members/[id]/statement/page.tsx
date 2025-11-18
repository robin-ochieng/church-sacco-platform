'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getMemberStatement, downloadStatementPDF, downloadReceiptPDF } from './api';
import { StatementResponse, LedgerEntry } from './types';
import { format, parseISO } from 'date-fns';
import { useTransientToast } from '@/hooks/useTransientToast';

export default function MemberStatementPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const memberId = params?.id as string;
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const { toast, showToast } = useTransientToast();
  
  // Filter states
  const [startDate, setStartDate] = useState(searchParams?.get('s') || '');
  const [endDate, setEndDate] = useState(searchParams?.get('e') || '');
  const [transactionType, setTransactionType] = useState(searchParams?.get('type') || '');

  useEffect(() => {
    if (memberId) {
      loadStatement();
    }
  }, [memberId, searchParams]);

  const loadStatement = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getMemberStatement({
        memberId,
        startDate: searchParams?.get('s') || undefined,
        endDate: searchParams?.get('e') || undefined,
        type: searchParams?.get('type') || undefined,
      });
      setStatement(data);
    } catch (err) {
      console.error('Failed to load statement:', err);
      setError('Failed to load statement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('s', startDate);
    if (endDate) params.set('e', endDate);
    if (transactionType) params.set('type', transactionType);
    
    router.push(`/members/${memberId}/statement?${params.toString()}`);
  };

  const handleFilterReset = () => {
    setStartDate('');
    setEndDate('');
    setTransactionType('');
    router.push(`/members/${memberId}/statement`);
  };

  const handleDownloadPDF = async () => {
    if (!memberId) return;
    try {
      setDownloadingStatement(true);
      await downloadStatementPDF({
        memberId,
        startDate: searchParams?.get('s') || undefined,
        endDate: searchParams?.get('e') || undefined,
        type: searchParams?.get('type') || undefined,
      });
      showToast('Statement PDF download started');
    } catch (err) {
      console.error('Failed to download statement PDF:', err);
      showToast('Unable to download PDF. Please try again.', 'error');
    } finally {
      setDownloadingStatement(false);
    }
  };

  const handleReceiptDownload = async (txn: LedgerEntry) => {
    if (!memberId) return;
    if (!txn.receiptNumber) {
      showToast('Receipt not available for this transaction.', 'error');
      return;
    }

    try {
      setDownloadingReceiptId(txn.id);
      await downloadReceiptPDF({ memberId, receiptNumber: txn.receiptNumber });
      showToast('Receipt PDF download started');
    } catch (err) {
      console.error('Failed to download receipt PDF:', err);
      showToast('Unable to download receipt. Please try again.', 'error');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return '—';
    }
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-gray-500">
            No statement data available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Member Statement
              </h1>
              <p className="text-gray-600 mt-1">
                {statement.member.firstName} {statement.member.lastName} • {statement.member.memberNumber}
              </p>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingStatement}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
            >
              <svg className={`w-5 h-5 ${downloadingStatement ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloadingStatement ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>

          {/* Period and Balance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Period</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatDate(statement.period.startDate)} - {formatDate(statement.period.endDate)}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Opening Balance</p>
              <p className="text-lg font-semibold text-blue-900">
                {formatCurrency(statement.openingBalance)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">Total Deposits</p>
              <p className="text-lg font-semibold text-green-900">
                {formatCurrency(statement.totalDeposits)}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600">Closing Balance</p>
              <p className="text-lg font-semibold text-purple-900">
                {formatCurrency(statement.closingBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction Type
              </label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="DEPOSIT">Deposits</option>
                <option value="WITHDRAWAL">Withdrawals</option>
                <option value="INTEREST">Interest</option>
                <option value="DIVIDEND">Dividends</option>
                <option value="ADJUSTMENT">Adjustments</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleFilterApply}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleFilterReset}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Transaction History ({statement.transactions.length} transactions)
            </h2>
          </div>
          
          {statement.transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No transactions found for the selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receipt #
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Debit
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {statement.transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(txn.valueDate || txn.date || txn.createdAt || '')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <span className="font-medium">{txn.type}</span>
                          {(txn.description || txn.narration) && (
                            <span className="text-gray-500"> • {txn.description || txn.narration}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {txn.channel}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {txn.receiptNumber || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                        {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                        {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
                        {formatCurrency(txn.balance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <button
                          onClick={() => handleReceiptDownload(txn)}
                          disabled={!txn.receiptNumber || downloadingReceiptId === txn.id}
                          className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-blue-600 hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                          aria-label="Download receipt PDF"
                        >
                          {downloadingReceiptId === txn.id ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
                              <path className="opacity-75" strokeWidth="4" strokeLinecap="round" d="M4 12a8 8 0 018-8"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v11m0 0l-4-4m4 4l4-4M5 19h14" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm font-semibold text-gray-900">
                      Totals
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-bold">
                      {formatCurrency(statement.totalWithdrawals)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-bold">
                      {formatCurrency(statement.totalDeposits)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                      {formatCurrency(statement.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Total Withdrawals Display */}
        {statement.totalWithdrawals > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              <span className="font-semibold">Total Withdrawals:</span> {formatCurrency(statement.totalWithdrawals)}
            </p>
          </div>
        )}
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
