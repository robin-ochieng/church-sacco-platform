'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { idAndRefereeSchema, type IdAndRefereeFormData } from '../schemas';
import { FileDropzone } from '@/components/FileDropzone';
import { KycDocumentType } from '@/lib/api/kyc';

interface IdAndRefereeStepProps {
  initialData?: Partial<IdAndRefereeFormData>;
  onNext: (data: IdAndRefereeFormData) => void;
  onBack: () => void;
}

interface KycUploadState {
  file: File | null;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
  filePath: string | null;
}

export function IdAndRefereeStep({ initialData, onNext, onBack }: IdAndRefereeStepProps) {
  const [kycUploads, setKycUploads] = useState<Record<KycDocumentType, KycUploadState>>({
    [KycDocumentType.ID_FRONT]: {
      file: null,
      uploading: false,
      uploaded: false,
      error: null,
      filePath: null,
    },
    [KycDocumentType.ID_BACK]: {
      file: null,
      uploading: false,
      uploaded: false,
      error: null,
      filePath: null,
    },
    [KycDocumentType.PHOTO]: {
      file: null,
      uploading: false,
      uploaded: false,
      error: null,
      filePath: null,
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IdAndRefereeFormData>({
    resolver: zodResolver(idAndRefereeSchema),
    defaultValues: initialData,
  });

  const handleFileSelect = (documentType: KycDocumentType) => (file: File) => {
    setKycUploads((prev) => ({
      ...prev,
      [documentType]: {
        ...prev[documentType],
        file,
        error: null,
      },
    }));
  };

  const handleFormSubmit = (data: IdAndRefereeFormData) => {
    // Store file references in form data for later upload
    const dataWithFiles = {
      ...data,
      kycFiles: {
        idFront: kycUploads[KycDocumentType.ID_FRONT].file,
        idBack: kycUploads[KycDocumentType.ID_BACK].file,
        photo: kycUploads[KycDocumentType.PHOTO].file,
      },
    };
    onNext(dataWithFiles as IdAndRefereeFormData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">ID & KYC Documents</h2>
        <p className="text-gray-600">Please provide your identification, referee details, and upload KYC documents</p>
      </div>

      {/* ID/Passport Number */}
      <div>
        <label htmlFor="idPassportNumber" className="block text-sm font-medium text-gray-700 mb-1">
          ID/Passport Number <span className="text-red-500">*</span>
        </label>
        <input
          {...register('idPassportNumber')}
          id="idPassportNumber"
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="12345678"
        />
        {errors.idPassportNumber && (
          <p className="mt-1 text-sm text-red-600">{errors.idPassportNumber.message}</p>
        )}
      </div>

      {/* Referee Member Number */}
      <div>
        <label htmlFor="refereeMemberNo" className="block text-sm font-medium text-gray-700 mb-1">
          Referee Member Number
        </label>
        <input
          {...register('refereeMemberNo')}
          id="refereeMemberNo"
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="ATSC-2024-0001"
        />
        <p className="mt-1 text-xs text-gray-500">Format: ATSC-YYYY-NNNN (Optional)</p>
        {errors.refereeMemberNo && (
          <p className="mt-1 text-sm text-red-600">{errors.refereeMemberNo.message}</p>
        )}
      </div>

      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Next of Kin Details</h3>

        {/* Next of Kin Name */}
        <div className="mb-4">
          <label htmlFor="nextOfKinName" className="block text-sm font-medium text-gray-700 mb-1">
            Next of Kin Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('nextOfKinName')}
            id="nextOfKinName"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Jane Doe"
          />
          {errors.nextOfKinName && (
            <p className="mt-1 text-sm text-red-600">{errors.nextOfKinName.message}</p>
          )}
        </div>

        {/* Next of Kin Phone */}
        <div className="mb-4">
          <label htmlFor="nextOfKinPhone" className="block text-sm font-medium text-gray-700 mb-1">
            Next of Kin Phone <span className="text-red-500">*</span>
          </label>
          <input
            {...register('nextOfKinPhone')}
            id="nextOfKinPhone"
            type="tel"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+254712345678"
          />
          <p className="mt-1 text-xs text-gray-500">Format: +254XXXXXXXXX</p>
          {errors.nextOfKinPhone && (
            <p className="mt-1 text-sm text-red-600">{errors.nextOfKinPhone.message}</p>
          )}
        </div>

        {/* Next of Kin Relationship */}
        <div>
          <label htmlFor="nextOfKinRelationship" className="block text-sm font-medium text-gray-700 mb-1">
            Relationship <span className="text-red-500">*</span>
          </label>
          <input
            {...register('nextOfKinRelationship')}
            id="nextOfKinRelationship"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Spouse, Parent, Sibling, etc."
          />
          {errors.nextOfKinRelationship && (
            <p className="mt-1 text-sm text-red-600">{errors.nextOfKinRelationship.message}</p>
          )}
        </div>
      </div>

      {/* KYC Document Uploads */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">KYC Document Uploads</h3>
        <p className="text-sm text-gray-600 mb-6">
          Upload clear images of your identification documents. These will be verified during account approval.
        </p>

        <div className="space-y-6">
          {/* ID Front */}
          <FileDropzone
            label="ID/Passport Front"
            accept="image/jpeg,image/png,image/jpg"
            maxSize={10}
            onFileSelect={handleFileSelect(KycDocumentType.ID_FRONT)}
            uploading={kycUploads[KycDocumentType.ID_FRONT].uploading}
            uploadedFile={
              kycUploads[KycDocumentType.ID_FRONT].file
                ? {
                    name: kycUploads[KycDocumentType.ID_FRONT].file!.name,
                  }
                : null
            }
            error={kycUploads[KycDocumentType.ID_FRONT].error}
            required={false}
          />

          {/* ID Back */}
          <FileDropzone
            label="ID/Passport Back"
            accept="image/jpeg,image/png,image/jpg"
            maxSize={10}
            onFileSelect={handleFileSelect(KycDocumentType.ID_BACK)}
            uploading={kycUploads[KycDocumentType.ID_BACK].uploading}
            uploadedFile={
              kycUploads[KycDocumentType.ID_BACK].file
                ? {
                    name: kycUploads[KycDocumentType.ID_BACK].file!.name,
                  }
                : null
            }
            error={kycUploads[KycDocumentType.ID_BACK].error}
            required={false}
          />

          {/* Photo */}
          <FileDropzone
            label="Profile Photo/Selfie"
            accept="image/jpeg,image/png,image/jpg"
            maxSize={10}
            onFileSelect={handleFileSelect(KycDocumentType.PHOTO)}
            uploading={kycUploads[KycDocumentType.PHOTO].uploading}
            uploadedFile={
              kycUploads[KycDocumentType.PHOTO].file
                ? {
                    name: kycUploads[KycDocumentType.PHOTO].file!.name,
                  }
                : null
            }
            error={kycUploads[KycDocumentType.PHOTO].error}
            required={false}
          />
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> KYC documents are optional during registration but may be required for account verification. 
            You can upload them later from your profile page.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
        >
          Back
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Next
        </button>
      </div>
    </form>
  );
}
