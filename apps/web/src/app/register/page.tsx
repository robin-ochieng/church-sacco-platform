'use client';

import Link from 'next/link';
import { useRegistrationForm } from '@/hooks/useRegistrationForm';
import { PersonalInfoStep } from './steps/PersonalInfoStep';
import { AddressInfoStep } from './steps/AddressInfoStep';
import { IdAndRefereeStep } from './steps/IdAndRefereeStep';
import { ReviewSubmitStep } from './steps/ReviewSubmitStep';
import type { PersonalInfoFormData, AddressInfoFormData, IdAndRefereeFormData, ReviewSubmitFormData } from './schemas';

const steps = [
  { number: 1, title: 'Personal', description: 'Basic information' },
  { number: 2, title: 'Address', description: 'Location details' },
  { number: 3, title: 'ID & Referee', description: 'Identification' },
  { number: 4, title: 'Review', description: 'Submit' },
];

export default function RegisterPage() {
  const {
    currentStep,
    formData,
    isSubmitting,
    error,
    nextStep,
    prevStep,
    goToStep,
    submitRegistration,
  } = useRegistrationForm();

  const handlePersonalInfoSubmit = (data: PersonalInfoFormData) => {
    nextStep(data);
  };

  const handleAddressInfoSubmit = (data: AddressInfoFormData) => {
    nextStep(data);
  };

  const handleIdAndRefereeSubmit = (data: IdAndRefereeFormData) => {
    nextStep(data);
  };

  const handleReviewSubmit = async (data: ReviewSubmitFormData) => {
    try {
      await submitRegistration(data);
    } catch {
      // Error state already handled inside useRegistrationForm
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
              <Link href="/loans/apply" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors hidden sm:block">
                Loans
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
              Join Our Community
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Member Registration
            </h1>
            <p className="text-gray-500 max-w-md mx-auto">
              Complete the form below to become a member of ACK Thiboro SACCO.
            </p>
          </div>

          {/* Step Indicator */}
          <div className="mb-10">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <button
                      onClick={() => step.number < currentStep && goToStep(step.number)}
                      disabled={step.number >= currentStep}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                        step.number === currentStep
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : step.number < currentStep
                          ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {step.number < currentStep ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </button>
                    <div className="mt-3 text-center">
                      <div className={`text-sm font-medium ${
                        step.number <= currentStep ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-400 hidden sm:block mt-0.5">{step.description}</div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-3 rounded-full ${
                      step.number < currentStep ? 'bg-emerald-500' : 'bg-gray-100'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            {currentStep === 1 && (
              <PersonalInfoStep
                initialData={formData}
                onNext={handlePersonalInfoSubmit}
              />
            )}

            {currentStep === 2 && (
              <AddressInfoStep
                initialData={formData}
                onNext={handleAddressInfoSubmit}
                onBack={prevStep}
              />
            )}

            {currentStep === 3 && (
              <IdAndRefereeStep
                initialData={formData}
                onNext={handleIdAndRefereeSubmit}
                onBack={prevStep}
              />
            )}

            {currentStep === 4 && (
              <ReviewSubmitStep
                formData={formData}
                initialData={formData}
                onSubmit={handleReviewSubmit}
                onBack={prevStep}
                isSubmitting={isSubmitting}
                error={error}
              />
            )}
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Already have an account?{' '}
              <Link href="/auth/sign-in" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Sign in
              </Link>
            </p>
            <p className="mt-3 text-gray-400 text-sm">
              Need help?{' '}
              <Link href="/contact" className="text-gray-500 hover:text-gray-700 transition-colors">
                Contact support
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
