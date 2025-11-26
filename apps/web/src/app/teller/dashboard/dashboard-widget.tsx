'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useTellerSummaryQuery, tellerSummaryKey } from '@/features/teller/dashboard/hooks';
import {
  TellerSummaryResponse,
  TellerSummaryTopMember,
  TellerSummaryReceipt,
} from '@/features/teller/dashboard/types';
import { formatKes } from '@/lib/format';
import { formatBankDate, formatTimestampForTable } from '@/lib/date';
import { SuspenseQueueWidget } from './suspense-queue-widget';

interface DashboardWidgetProps {
  initialDate: string;
}

const createEmptySummary = (date: string): TellerSummaryResponse => ({
  date,
  meta: { generatedAt: new Date().toISOString() },
  totals: {
    depositCount: 0,
    depositAmount: '0.00',
    uniqueMembers: 0,
  },
  topMembers: [],
  recentReceipts: [],
  closeDayDryRun: {
    eligible: false,
    projectedNetCash: '0.00',
    warnings: ['Waiting for transactions before closing the day.'],
    lastReceiptTimestamp: '',
  },
});

export function DashboardWidget({ initialDate }: DashboardWidgetProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);
  const queryClient = useQueryClient();
  const { data, isPending, isFetching, isError, error } = useTellerSummaryQuery(selectedDate);
  const [isCloseDayDialogOpen, setIsCloseDayDialogOpen] = useState(false);
  const closeDayGuardRef = useRef(false);

  const summary = data ?? createEmptySummary(selectedDate);
  const heroDateLabel = selectedDate
    ? formatBankDate(selectedDate)
    : 'Select a date to view activity';
  const receipts = summary.recentReceipts.slice(0, 10);

  const showSkeleton = isPending && !data;
  const showErrorState = isError && !data;

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: tellerSummaryKey(selectedDate) });
  };

  const handleCloseDayDryRun = () => {
    if (!summary.closeDayDryRun.eligible || closeDayGuardRef.current) {
      return;
    }
    closeDayGuardRef.current = true;
    setIsCloseDayDialogOpen(true);
    setTimeout(() => {
      closeDayGuardRef.current = false;
    }, 600);
  };

  const infoBanner = (function computeBanner() {
    if (isFetching && data) {
      return 'Refreshing...';
    }
    if (summary.closeDayDryRun.warnings.length > 0 && summary.closeDayDryRun.eligible) {
      return summary.closeDayDryRun.warnings[0];
    }
    return undefined;
  })();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Live teller operations
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">
              Teller Dashboard — {heroDateLabel}
            </h1>
            <p className="text-sm text-slate-500">
              Auto-refreshing every 5&nbsp;seconds {isFetching ? '- Refreshing...' : '- Up to date'}
            </p>
            {infoBanner && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {infoBanner}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">

          </div>
          <label className="flex flex-col text-sm text-slate-600">
            <span className="mb-1 font-medium">Date (local)</span>
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedDate}
              max={initialDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setSelectedDate(nextDate || initialDate);
              }}
              aria-label="Choose reporting date"
            />
          </label>
        </header>

        {showErrorState ? (
          <ErrorState message={error instanceof Error ? error.message : 'Unable to load dashboard'} onRetry={handleRetry} />
        ) : showSkeleton ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-6">
            <SuspenseQueueWidget />
            <KpiRow totals={summary.totals} isBusy={isFetching} />

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="col-span-2 rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Recent Receipts</h2>
                    <p className="text-sm text-slate-500">Latest 10 receipts posted today</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {receipts.length} shown
                  </span>
                </div>
                <RecentReceiptsTable receipts={receipts} />
              </section>

              <section className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Top Members Today</h2>
                    <p className="text-sm text-slate-500">Highest deposit volume</p>
                  </div>
                  <span className="text-sm font-medium text-slate-400">{summary.topMembers.length} total</span>
                </div>
                <TopMembersList members={summary.topMembers} />
              </section>
            </div>

            <CloseDayPanel
              dryRun={summary.closeDayDryRun}
              onDryRun={handleCloseDayDryRun}
              isBusy={isFetching}
            />
          </div>
        )}
      </div>

      <CloseDayDialog
        open={isCloseDayDialogOpen}
        onClose={() => setIsCloseDayDialogOpen(false)}
        dryRun={summary.closeDayDryRun}
      />
    </main>
  );
}

function KpiRow({
  totals,
  isBusy,
}: {
  totals: TellerSummaryResponse['totals'];
  isBusy: boolean;
}) {
  return (
    <section
      className="grid gap-4 md:grid-cols-3"
      aria-live="polite"
      aria-busy={isBusy}
    >
      <KpiCard label="Deposits" value={totals.depositCount.toLocaleString()} subLabel="count" />
      <KpiCard label="Total Amount" value={formatKes(totals.depositAmount)} subLabel="KES" />
      <KpiCard label="Unique Members" value={totals.uniqueMembers.toLocaleString()} subLabel="served" />
    </section>
  );
}

function KpiCard({
  label,
  value,
  subLabel,
}: {
  label: string;
  value: string;
  subLabel: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs uppercase tracking-wide text-slate-400">{subLabel}</p>
    </article>
  );
}

function TopMembersList({ members }: { members: TellerSummaryTopMember[] }) {
  if (members.length === 0) {
    return <EmptyState message="No members have deposited yet today." />;
  }

  return (
    <ul className="mt-4 space-y-4">
      {members.map((member) => (
        <li key={member.memberId} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
              {getInitials(member.fullName)}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{member.fullName}</p>
              <p className="text-sm text-slate-500">
                {member.receiptCount} receipts - Last #{member.lastReceiptId}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold text-slate-900">
              {formatKes(member.totalDeposits)}
            </p>
            <p className="text-xs text-slate-500">
              {formatTimestampForTable(member.lastReceiptTimestamp)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentReceiptsTable({ receipts }: { receipts: TellerSummaryReceipt[] }) {
  if (receipts.length === 0) {
    return <EmptyState message="No receipts have been posted yet." />;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead>
          <tr className="text-left text-sm text-slate-500">
            <th className="px-3 py-2">Receipt</th>
            <th className="px-3 py-2">Member</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Channel</th>
            <th className="px-3 py-2">Teller</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {receipts.map((receipt) => (
            <tr key={receipt.id} className="hover:bg-slate-50">
              <td className="px-3 py-3 font-medium text-blue-600">
                <Link href={`/receipts/${receipt.id}`} className="underline-offset-2 hover:underline">
                  View #{receipt.id}
                </Link>
              </td>
              <td className="px-3 py-3 text-slate-700">{receipt.memberName}</td>
              <td className="px-3 py-3 font-semibold text-slate-900">
                {formatKes(receipt.amount)}
              </td>
              <td className="px-3 py-3" title={receipt.method}>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {receipt.method}
                </span>
              </td>
              <td className="px-3 py-3 text-slate-600">{receipt.tellerName}</td>
              <td className="px-3 py-3">
                <StatusBadge status={receipt.status} />
              </td>
              <td className="px-3 py-3 text-slate-500">
                {formatTimestampForTable(receipt.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: TellerSummaryReceipt['status'] }) {
  const statusClass = {
    POSTED: 'bg-emerald-100 text-emerald-700',
    PENDING: 'bg-amber-100 text-amber-700',
    FAILED: 'bg-rose-100 text-rose-700',
  }[status] ?? 'bg-slate-100 text-slate-600';

  return (
    <span className={clsx('rounded-full px-2 py-1 text-xs font-semibold', statusClass)}>
      {status}
    </span>
  );
}

function CloseDayPanel({
  dryRun,
  onDryRun,
  isBusy,
}: {
  dryRun: TellerSummaryResponse['closeDayDryRun'];
  onDryRun: () => void;
  isBusy: boolean;
}) {
  const disabledReason = !dryRun.eligible
    ? dryRun.warnings[0] ?? 'All receipts must be posted before closing the day.'
    : undefined;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Close Day (Dry Run)</h2>
          <p className="text-sm text-slate-500">
            Projected net cash: <span className="font-semibold text-slate-900">{formatKes(dryRun.projectedNetCash)}</span>
          </p>
          <p className="text-xs text-slate-400">
            Last receipt posted {dryRun.lastReceiptTimestamp ? formatTimestampForTable(dryRun.lastReceiptTimestamp) : 'N/A'}
          </p>
          {dryRun.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">
              {dryRun.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onDryRun}
          disabled={!dryRun.eligible || isBusy}
          title={disabledReason}
          className={clsx(
            'inline-flex items-center justify-center rounded-lg px-5 py-3 text-base font-semibold text-white shadow-sm transition',
            dryRun.eligible && !isBusy
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'cursor-not-allowed bg-slate-300'
          )}
        >
          Close Day (Dry Run)
        </button>
      </div>
    </section>
  );
}

function CloseDayDialog({
  open,
  onClose,
  dryRun,
}: {
  open: boolean;
  onClose: () => void;
  dryRun: TellerSummaryResponse['closeDayDryRun'];
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    if (!node) {
      return undefined;
    }
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(node.querySelectorAll<HTMLElement>(selector));
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'Tab' && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-day-dialog-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 id="close-day-dialog-title" className="text-xl font-semibold text-slate-900">
              Close Day Preview
            </h3>
            <p className="text-sm text-slate-500">
              Review the dry-run before the Phase 2 hard close.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dismiss close day preview"
          >
            &times;
          </button>
        </div>

        <dl className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-500">Projected net cash</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {formatKes(dryRun.projectedNetCash)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-500">Last receipt timestamp</dt>
            <dd className="text-sm text-slate-900">
              {dryRun.lastReceiptTimestamp
                ? formatTimestampForTable(dryRun.lastReceiptTimestamp)
                : 'Not available'}
            </dd>
          </div>
        </dl>

        <section className="mt-6">
          <h4 className="text-sm font-semibold text-slate-800">Warnings</h4>
          {dryRun.warnings.length === 0 ? (
            <p className="text-sm text-slate-500">No outstanding checks. You can safely close the day.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-700">
              {dryRun.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Confirm Dry Run
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 h-80 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <h2 className="text-xl font-semibold text-rose-700">Unable to load dashboard</h2>
      <p className="mt-2 text-sm text-rose-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
      >
        Retry
      </button>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}
