import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KycDocumentType, uploadKycDocument } from '../lib/api/kyc';
import { registerMember, type RegistrationData } from '../lib/api/members';

interface KycFiles {
  idFront?: File | null;
  idBack?: File | null;
  photo?: File | null;
}

interface FormData {
  // Step 1: Personal Info
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  telephone: string;
  emailOptional?: string;

  // Step 2: Address & Church Group
  physicalAddress: string;
  poBox?: string;
  churchGroup?: string;

  // Step 3: ID & Referee
  idPassportNumber: string;
  refereeMemberNo?: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;
  kycFiles?: KycFiles;

  // Step 4: Review & Submit
  email: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
  agreedToRefundPolicy: boolean;
}

export function useRegistrationForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStep = (stepData: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...stepData }));
    setCurrentStep((prev) => Math.min(prev + 1, 4));
    setError(null);
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step);
      setError(null);
    }
  };

  const submitRegistration = async (finalData: Partial<FormData>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const completeData = { ...formData, ...finalData };

      // Validate required fields
      if (!completeData.email || !completeData.password) {
        throw new Error('Email and password are required');
      }

      // Remove confirmPassword and kycFiles before sending to API
      const { confirmPassword, emailOptional, kycFiles, ...apiData } = completeData as FormData;

      const registrationData: RegistrationData = {
        ...apiData,
        email: completeData.email!,
        password: completeData.password!,
        agreedToTerms: completeData.agreedToTerms || false,
        agreedToRefundPolicy: completeData.agreedToRefundPolicy || false,
      };

      const result = await registerMember(registrationData);

      // Upload KYC documents if provided (non-blocking)
      if (kycFiles && result.member.id) {
        const uploadPromises: Promise<any>[] = [];

        if (kycFiles.idFront) {
          uploadPromises.push(
            uploadKycDocument(
              result.member.id,
              kycFiles.idFront,
              KycDocumentType.ID_FRONT,
              result.access_token || '',
            ).catch((err) => console.error('ID Front upload failed:', err))
          );
        }

        if (kycFiles.idBack) {
          uploadPromises.push(
            uploadKycDocument(
              result.member.id,
              kycFiles.idBack,
              KycDocumentType.ID_BACK,
              result.access_token || '',
            ).catch((err) => console.error('ID Back upload failed:', err))
          );
        }

        if (kycFiles.photo) {
          uploadPromises.push(
            uploadKycDocument(
              result.member.id,
              kycFiles.photo,
              KycDocumentType.PHOTO,
              result.access_token || '',
            ).catch((err) => console.error('Photo upload failed:', err))
          );
        }

        // Wait for all uploads (but don't block success if they fail)
        await Promise.allSettled(uploadPromises);
      }

      // Success - redirect to success page
      router.push(`/register/success?memberNumber=${result.member.memberNumber}`);

      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Registration failed';
      setError(Array.isArray(message) ? message.join(', ') : message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    currentStep,
    formData,
    isSubmitting,
    error,
    nextStep,
    prevStep,
    goToStep,
    submitRegistration,
  };
}
