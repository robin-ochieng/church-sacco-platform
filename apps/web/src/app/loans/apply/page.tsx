'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';

const loanSchema = z.object({
  memberId: z.string().uuid('Invalid Member ID'),
  loanAmount: z.number().min(1000, 'Minimum loan amount is 1000'),
  purpose: z.string().min(5, 'Purpose must be at least 5 characters'),
  repaymentMonths: z.number().min(1).max(60),
  monthlyIncome: z.number().min(0),
  sourceIncome: z.string().min(3),
  disbursementMode: z.enum(['NET', 'GROSS']),
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function LoanApplicationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      disbursementMode: 'GROSS',
    }
  });

  const onSubmit = async (data: LoanFormData) => {
    setIsSubmitting(true);
    setMessage('');
    try {
      // Assuming API URL is configured via env or proxy. Using localhost:3000 for dev.
      // In production, this should be process.env.NEXT_PUBLIC_API_URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await axios.post(`${apiUrl}/loans`, data);
      setMessage(`Loan application submitted successfully! Loan Number: ${response.data.loanNumber}`);
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AT</span>
              </div>
              <span className="text-gray-900 font-semibold">ACK Thiboro SACCO</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/register" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors hidden sm:block">
                Register
              </Link>
              <Link
                href="/auth/sign-in"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-28 pb-16 px-4">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-blue-600 font-medium text-sm mb-3 tracking-wide uppercase">
              Quick Application
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Apply for a Loan
            </h1>
            <p className="text-gray-500">
              Get affordable credit at competitive rates with flexible repayment.
            </p>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-800 font-medium">Need guarantors?</p>
              <p className="text-sm text-blue-600 mt-0.5">
                Use our{' '}
                <Link href="/loans/apply/wizard" className="underline hover:text-blue-700 font-medium">
                  step-by-step wizard
                </Link>{' '}
                to add guarantors to your loan application.
              </p>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 ${
              message.startsWith('Error') 
                ? 'bg-red-50 border border-red-100' 
                : 'bg-emerald-50 border border-emerald-100'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                message.startsWith('Error') ? 'bg-red-100' : 'bg-emerald-100'
              }`}>
                {message.startsWith('Error') ? (
                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className={`text-sm ${message.startsWith('Error') ? 'text-red-700' : 'text-emerald-700'}`}>
                {message}
              </p>
            </div>
          )}

          {/* Form Container */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Member ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Member ID</label>
                <input
                  {...register('memberId')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter Member UUID"
                />
                {errors.memberId && <p className="text-red-500 text-xs mt-1.5">{errors.memberId.message}</p>}
              </div>

              {/* Loan Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Loan Amount (KES)</label>
                <input
                  type="number"
                  {...register('loanAmount', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  placeholder="e.g., 50000"
                />
                {errors.loanAmount && <p className="text-red-500 text-xs mt-1.5">{errors.loanAmount.message}</p>}
              </div>

              {/* Repayment Months */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Repayment Period (Months)</label>
                <input
                  type="number"
                  {...register('repaymentMonths', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  placeholder="1-60 months"
                />
                {errors.repaymentMonths && <p className="text-red-500 text-xs mt-1.5">{errors.repaymentMonths.message}</p>}
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Purpose of Loan</label>
                <textarea
                  {...register('purpose')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400 resize-none"
                  rows={3}
                  placeholder="What will you use this loan for?"
                />
                {errors.purpose && <p className="text-red-500 text-xs mt-1.5">{errors.purpose.message}</p>}
              </div>

              {/* Monthly Income */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Income (KES)</label>
                <input
                  type="number"
                  {...register('monthlyIncome', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  placeholder="e.g., 80000"
                />
                {errors.monthlyIncome && <p className="text-red-500 text-xs mt-1.5">{errors.monthlyIncome.message}</p>}
              </div>

              {/* Source of Income */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Source of Income</label>
                <input
                  {...register('sourceIncome')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  placeholder="e.g., Employment, Business"
                />
                {errors.sourceIncome && <p className="text-red-500 text-xs mt-1.5">{errors.sourceIncome.message}</p>}
              </div>

              {/* Disbursement Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Disbursement Mode</label>
                <select
                  {...register('disbursementMode')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 bg-white"
                >
                  <option value="GROSS">GROSS (Pay fees separately)</option>
                  <option value="NET">NET (Deduct fees from loan)</option>
                </select>
                {errors.disbursementMode && <p className="text-red-500 text-xs mt-1.5">{errors.disbursementMode.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Application'
                )}
              </button>
            </form>
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Not a member yet?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} ACK Thiboro SACCO. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
