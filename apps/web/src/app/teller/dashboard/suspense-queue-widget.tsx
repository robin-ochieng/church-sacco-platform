'use client';

import { useState } from 'react';
import { useMpesaSuspenseQuery, useResolveMpesaSuspenseMutation } from '@/features/teller/dashboard/hooks';
import { formatKes } from '@/lib/format';
import { formatTimestampForTable } from '@/lib/date';

export function SuspenseQueueWidget() {
  const { data: messages, isLoading } = useMpesaSuspenseQuery();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const resolveMutation = useResolveMpesaSuspenseMutation();

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessageId || !memberId) return;

    try {
      await resolveMutation.mutateAsync({ messageId: selectedMessageId, memberId });
      setSelectedMessageId(null);
      setMemberId('');
    } catch (error) {
      console.error('Failed to resolve message:', error);
      alert('Failed to resolve message. Please check the Member ID.');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-slate-100 rounded-lg"></div>;
  }

  if (!messages || messages.length === 0) {
    return null; // Don't show if no suspense messages
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-amber-900">
          ⚠️ Suspense Queue ({messages.length})
        </h2>
        <span className="text-sm text-amber-700">
          Unmatched M-Pesa transactions requiring attention
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-amber-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Ref / Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Sender
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {messages.map((msg) => (
              <tr key={msg.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium text-slate-900">{msg.mpesaRef}</div>
                  <div className="text-xs text-slate-500">
                    {formatTimestampForTable(msg.createdAt)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="text-sm text-slate-900">{msg.msisdn}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[150px]">
                    {msg.narrative}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                  {formatKes(msg.amount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedMessageId(msg.id)}
                    className="rounded bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                  >
                    Resolve
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resolve Modal */}
      {selectedMessageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Resolve Suspense Transaction
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              Assign this transaction to a member. Enter the Member ID below.
            </p>
            
            <form onSubmit={handleResolve}>
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Member ID
                </label>
                <input
                  type="text"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. clp..."
                  required
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMessageId(null);
                    setMemberId('');
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveMutation.isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {resolveMutation.isPending ? 'Assigning...' : 'Assign & Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
