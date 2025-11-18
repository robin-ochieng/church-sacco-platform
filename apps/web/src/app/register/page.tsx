'use client';

import { useRegistrationForm } from '@/hooks/useRegistrationForm';
import { PersonalInfoStep } from './steps/PersonalInfoStep';
import { AddressInfoStep } from './steps/AddressInfoStep';
import { IdAndRefereeStep } from './steps/IdAndRefereeStep';
import { ReviewSubmitStep } from './steps/ReviewSubmitStep';
import type { PersonalInfoFormData, AddressInfoFormData, IdAndRefereeFormData, ReviewSubmitFormData } from './schemas';

const steps = [
  { number: 1, title: 'Personal Info', description: 'Basic information' },
  { number: 2, title: 'Address', description: 'Location details' },
  { number: 3, title: 'ID & Referee', description: 'Identification' },
  { number: 4, title: 'Review', description: 'Submit registration' },
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Member Registration</h1>
          <p className="mt-2 text-gray-600">Join the Church SACCO Platform</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <button
                    onClick={() => step.number < currentStep && goToStep(step.number)}
                    disabled={step.number >= currentStep}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      step.number === currentStep
                        ? 'bg-blue-600 text-white'
                        : step.number < currentStep
                        ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {step.number < currentStep ? (
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </button>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-medium text-gray-900">{step.title}</div>
                    <div className="text-xs text-gray-500 hidden sm:block">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 ${
                      step.number < currentStep ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
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
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:underline font-medium">
              Sign in
            </a>
          </p>
          <p className="mt-2">
            Need help?{' '}
            <a href="/contact" className="text-blue-600 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
