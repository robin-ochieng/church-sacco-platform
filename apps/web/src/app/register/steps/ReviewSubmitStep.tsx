'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reviewSubmitSchema, type ReviewSubmitFormData } from '../schemas';

interface ReviewSubmitStepProps {
  formData: any;
  initialData?: Partial<ReviewSubmitFormData>;
  onSubmit: (data: ReviewSubmitFormData) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function ReviewSubmitStep({
  formData,
  initialData,
  onSubmit,
  onBack,
  isSubmitting,
  error,
}: ReviewSubmitStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewSubmitFormData>({
    resolver: zodResolver(reviewSubmitSchema),
    defaultValues: initialData,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Review & Submit</h2>
        <p className="text-gray-600">Please review your information and create your account</p>
      </div>

      {/* Review Summary */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg mb-4">Registration Summary</h3>

        {/* Personal Information */}
        <div className="border-b pb-4">
          <h4 className="font-medium text-sm text-gray-500 mb-2">Personal Information</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Name:</span> {formData.firstName} {formData.middleName}{' '}
              {formData.lastName}
            </div>
            <div>
              <span className="text-gray-600">DOB:</span> {formData.dateOfBirth}
            </div>
            <div>
              <span className="text-gray-600">Gender:</span> {formData.gender}
            </div>
            <div>
              <span className="text-gray-600">Phone:</span> {formData.telephone}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="border-b pb-4">
          <h4 className="font-medium text-sm text-gray-500 mb-2">Address</h4>
          <div className="text-sm space-y-1">
            <div>{formData.physicalAddress}</div>
            {formData.poBox && <div>P.O. Box: {formData.poBox}</div>}
            {formData.churchGroup && <div>Church Group: {formData.churchGroup}</div>}
          </div>
        </div>

        {/* ID & Next of Kin */}
        <div>
          <h4 className="font-medium text-sm text-gray-500 mb-2">ID & Next of Kin</h4>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-gray-600">ID Number:</span> {formData.idPassportNumber}
            </div>
            {formData.refereeMemberNo && (
              <div>
                <span className="text-gray-600">Referee:</span> {formData.refereeMemberNo}
              </div>
            )}
            <div>
              <span className="text-gray-600">Next of Kin:</span> {formData.nextOfKinName} (
              {formData.nextOfKinRelationship})
            </div>
          </div>
        </div>
      </div>

      {/* Account Credentials */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Create Your Account</h3>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            {...register('email')}
            id="email"
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your.email@example.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            This will be your login email
          </p>
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            {...register('password')}
            id="password"
            type="password"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Min. 8 characters"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <input
            {...register('confirmPassword')}
            id="confirmPassword"
            type="password"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Repeat password"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="space-y-3">
        <div className="flex items-start">
          <input
            {...register('agreedToTerms')}
            id="agreedToTerms"
            type="checkbox"
            className="mt-1 mr-2"
          />
          <label htmlFor="agreedToTerms" className="text-sm">
            I agree to the{' '}
            <a href="/terms" className="text-blue-600 hover:underline" target="_blank">
              Terms and Conditions
            </a>{' '}
            <span className="text-red-500">*</span>
          </label>
        </div>
        {errors.agreedToTerms && (
          <p className="text-sm text-red-600">{errors.agreedToTerms.message}</p>
        )}

        <div className="flex items-start">
          <input
            {...register('agreedToRefundPolicy')}
            id="agreedToRefundPolicy"
            type="checkbox"
            className="mt-1 mr-2"
          />
          <label htmlFor="agreedToRefundPolicy" className="text-sm">
            I agree to the{' '}
            <a href="/refund-policy" className="text-blue-600 hover:underline" target="_blank">
              Refund Policy
            </a>{' '}
            <span className="text-red-500">*</span>
          </label>
        </div>
        {errors.agreedToRefundPolicy && (
          <p className="text-sm text-red-600">{errors.agreedToRefundPolicy.message}</p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Submitting...
            </>
          ) : (
            'Submit Registration'
          )}
        </button>
      </div>
    </form>
  );
}
