'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { GuarantorSelection, SelectedGuarantor } from '@/components/loans';

// Step 1: Basic loan details
const loanDetailsSchema = z.object({
  memberId: z.string().uuid('Invalid Member ID'),
  loanAmount: z.number().min(1000, 'Minimum loan amount is 1000'),
  purpose: z.string().min(5, 'Purpose must be at least 5 characters'),
  repaymentMonths: z.number().min(1).max(60),
});

// Step 2: Income details
const incomeDetailsSchema = z.object({
  monthlyIncome: z.number().min(1, 'Monthly income is required'),
  sourceOfIncome: z.string().min(3, 'Source of income is required'),
  disbursementMode: z.enum(['NET', 'GROSS']),
});

type LoanDetailsFormData = z.infer<typeof loanDetailsSchema>;
type IncomeDetailsFormData = z.infer<typeof incomeDetailsSchema>;

// Combined type for full loan application (used for final submission)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LoanApplicationData = LoanDetailsFormData & IncomeDetailsFormData & {
  guarantors: SelectedGuarantor[];
};

const STEPS = [
  { id: 1, name: 'Loan Details', description: 'Basic info' },
  { id: 2, name: 'Income', description: 'Financial info' },
  { id: 3, name: 'Guarantors', description: 'Select guarantors' },
  { id: 4, name: 'Review', description: 'Submit' },
];

export default function LoanApplicationWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form data across steps
  const [loanDetails, setLoanDetails] = useState<LoanDetailsFormData | null>(null);
  const [incomeDetails, setIncomeDetails] = useState<IncomeDetailsFormData | null>(null);
  const [selectedGuarantors, setSelectedGuarantors] = useState<SelectedGuarantor[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Step 1 Form
  const loanDetailsForm = useForm<LoanDetailsFormData>({
    resolver: zodResolver(loanDetailsSchema),
    defaultValues: loanDetails || {
      repaymentMonths: 12,
    },
  });

  // Step 2 Form
  const incomeDetailsForm = useForm<IncomeDetailsFormData>({
    resolver: zodResolver(incomeDetailsSchema),
    defaultValues: incomeDetails || {
      disbursementMode: 'GROSS',
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  // Handle Step 1 submission - Create draft loan
  const handleLoanDetailsSubmit = async (data: LoanDetailsFormData) => {
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      // Create a draft loan
      const response = await axios.post(`${apiUrl}/loans`, {
        memberId: data.memberId,
        amount: data.loanAmount,
        purpose: data.purpose,
        durationMonths: data.repaymentMonths,
        monthlyIncome: 0, // Placeholder, will update in step 2
        sourceOfIncome: '', // Placeholder
        status: 'DRAFT',
      });
      
      setLoanId(response.data.id);
      setLoanDetails(data);
      setCurrentStep(2);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create loan application' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 2 submission - Update loan with income details
  const handleIncomeDetailsSubmit = async (data: IncomeDetailsFormData) => {
    if (!loanId) return;
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      await axios.patch(`${apiUrl}/loans/${loanId}`, {
        monthlyIncome: data.monthlyIncome,
        sourceOfIncome: data.sourceOfIncome,
        disbursementMode: data.disbursementMode,
      });
      
      setIncomeDetails(data);
      setCurrentStep(3);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update loan details' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 3 - Guarantors
  const handleGuarantorsComplete = async () => {
    if (!loanId || !loanDetails) return;
    
    // Check minimum requirements
    if (selectedGuarantors.length < 2) {
      setMessage({ type: 'error', text: 'Please select at least 2 guarantors' });
      return;
    }
    
    const totalGuaranteed = selectedGuarantors.reduce((sum, g) => sum + g.amountGuaranteed, 0);
    if (totalGuaranteed < loanDetails.loanAmount) {
      setMessage({ type: 'error', text: 'Total guaranteed amount must cover the full loan amount' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      // Add each guarantor to the loan
      for (const guarantor of selectedGuarantors) {
        await axios.post(`${apiUrl}/loans/${loanId}/guarantors`, {
          guarantorMemberId: guarantor.guarantorMemberId,
          amountGuaranteed: guarantor.amountGuaranteed,
        });
      }
      
      setCurrentStep(4);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to add guarantors' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle final submission
  const handleFinalSubmit = async () => {
    if (!loanId) return;
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      // Submit the loan for review
      await axios.patch(`${apiUrl}/loans/${loanId}/submit`);
      
      setMessage({ type: 'success', text: 'Loan application submitted successfully! It will be reviewed by the loan committee.' });
      // Could redirect to loan status page here
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to submit loan application' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigate back
  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
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
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-blue-600 font-medium text-sm mb-3 tracking-wide uppercase">
              Step-by-Step Application
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Loan Application
            </h1>
            <p className="text-gray-500">
              Complete all steps to submit your loan application with guarantors.
            </p>
          </div>

          {/* Progress Steps */}
          <nav aria-label="Progress" className="mb-10">
            <div className="flex items-center justify-between">
              {STEPS.map((step, stepIdx) => (
                <div key={step.name} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all
                      ${currentStep > step.id 
                        ? 'bg-emerald-500 text-white' 
                        : currentStep === step.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                          : 'bg-gray-100 text-gray-400'}
                    `}>
                      {currentStep > step.id ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.id
                      )}
                    </div>
                    <div className="mt-3 text-center">
                      <span className={`text-sm font-medium ${
                        currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {step.name}
                      </span>
                      <p className="text-xs text-gray-400 hidden sm:block mt-0.5">{step.description}</p>
                    </div>
                  </div>
                  {stepIdx !== STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-3 rounded-full ${
                      currentStep > step.id ? 'bg-emerald-500' : 'bg-gray-100'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </nav>

          {/* Message */}
          {message && (
            <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 ${
              message.type === 'error' 
                ? 'bg-red-50 border border-red-100' 
                : 'bg-emerald-50 border border-emerald-100'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                message.type === 'error' ? 'bg-red-100' : 'bg-emerald-100'
              }`}>
                {message.type === 'error' ? (
                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className={`text-sm ${message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
                {message.text}
              </p>
            </div>
          )}

          {/* Step Content */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            
            {/* Step 1: Loan Details */}
            {currentStep === 1 && (
              <form onSubmit={loanDetailsForm.handleSubmit(handleLoanDetailsSubmit)} className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Loan Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Enter the basic information about your loan.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Member ID</label>
                  <input
                    {...loanDetailsForm.register('memberId')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter Member UUID"
                  />
                  {loanDetailsForm.formState.errors.memberId && (
                    <p className="text-red-500 text-xs mt-1.5">{loanDetailsForm.formState.errors.memberId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Loan Amount (KES)</label>
                  <input
                    type="number"
                    {...loanDetailsForm.register('loanAmount', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                    placeholder="e.g., 50000"
                  />
                  {loanDetailsForm.formState.errors.loanAmount && (
                    <p className="text-red-500 text-xs mt-1.5">{loanDetailsForm.formState.errors.loanAmount.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Repayment Period (Months)</label>
                  <input
                    type="number"
                    {...loanDetailsForm.register('repaymentMonths', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                    placeholder="1-60 months"
                  />
                  {loanDetailsForm.formState.errors.repaymentMonths && (
                    <p className="text-red-500 text-xs mt-1.5">{loanDetailsForm.formState.errors.repaymentMonths.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Purpose of Loan</label>
                  <textarea
                    {...loanDetailsForm.register('purpose')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400 resize-none"
                    rows={3}
                    placeholder="What will you use this loan for?"
                  />
                  {loanDetailsForm.formState.errors.purpose && (
                    <p className="text-red-500 text-xs mt-1.5">{loanDetailsForm.formState.errors.purpose.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Income Details */}
            {currentStep === 2 && (
              <form onSubmit={incomeDetailsForm.handleSubmit(handleIncomeDetailsSubmit)} className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Income Information</h2>
                  <p className="text-sm text-gray-500 mt-1">Tell us about your income and financial situation.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Income (KES)</label>
                  <input
                    type="number"
                    {...incomeDetailsForm.register('monthlyIncome', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                    placeholder="e.g., 80000"
                  />
                  {incomeDetailsForm.formState.errors.monthlyIncome && (
                    <p className="text-red-500 text-xs mt-1.5">{incomeDetailsForm.formState.errors.monthlyIncome.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Source of Income</label>
                  <input
                    {...incomeDetailsForm.register('sourceOfIncome')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 placeholder:text-gray-400"
                    placeholder="e.g., Employment, Business, etc."
                  />
                  {incomeDetailsForm.formState.errors.sourceOfIncome && (
                    <p className="text-red-500 text-xs mt-1.5">{incomeDetailsForm.formState.errors.sourceOfIncome.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Disbursement Mode</label>
                  <select
                    {...incomeDetailsForm.register('disbursementMode')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 bg-white"
                  >
                    <option value="GROSS">GROSS (Pay fees separately)</option>
                    <option value="NET">NET (Deduct fees from loan)</option>
                  </select>
                  {incomeDetailsForm.formState.errors.disbursementMode && (
                    <p className="text-red-500 text-xs mt-1.5">{incomeDetailsForm.formState.errors.disbursementMode.message}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                  >
                    {isSubmitting ? 'Processing...' : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Guarantors */}
            {currentStep === 3 && loanId && loanDetails && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Select Guarantors</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    You need at least 2 guarantors whose combined guarantee covers your loan amount.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-blue-800 font-medium">Eligibility Requirements</p>
                      <p className="text-sm text-blue-600 mt-0.5">
                        Eligible guarantors must have been members for at least 12 months and have sufficient share balance.
                      </p>
                    </div>
                  </div>
                </div>
                
                <GuarantorSelection
                  loanId={loanId}
                  loanAmount={loanDetails.loanAmount}
                  selectedGuarantors={selectedGuarantors}
                  onGuarantorsChange={setSelectedGuarantors}
                  minGuarantors={2}
                />

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleGuarantorsComplete}
                    disabled={isSubmitting || selectedGuarantors.length < 2}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                  >
                    {isSubmitting ? 'Processing...' : 'Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && loanDetails && incomeDetails && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Review Your Application</h2>
                  <p className="text-sm text-gray-500 mt-1">Please review all details before submitting.</p>
                </div>
                
                {/* Loan Summary */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    Loan Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Loan Amount</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{formatCurrency(loanDetails.loanAmount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Repayment Period</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{loanDetails.repaymentMonths} months</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Purpose</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{loanDetails.purpose}</p>
                    </div>
                  </div>
                </div>

                {/* Income Summary */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    Income Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Monthly Income</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{formatCurrency(incomeDetails.monthlyIncome)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Source</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{incomeDetails.sourceOfIncome}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Disbursement</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{incomeDetails.disbursementMode}</p>
                    </div>
                  </div>
                </div>

                {/* Guarantors Summary */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    Guarantors ({selectedGuarantors.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedGuarantors.map((g) => (
                      <div key={g.guarantorMemberId} className="flex justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                        <span className="text-gray-700">{g.firstName} {g.lastName} ({g.memberNumber})</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(g.amountGuaranteed)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-3 border-t border-gray-200">
                      <span className="font-semibold text-gray-900">Total Guaranteed</span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(selectedGuarantors.reduce((sum, g) => sum + g.amountGuaranteed, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Important Notice</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      By submitting this application, you confirm that all information provided is accurate.
                      Your guarantors will be notified to approve their guarantee commitments.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
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
                </div>
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Need a simpler form?{' '}
              <Link href="/loans/apply" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Try quick application
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
