'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { personalInfoSchema, type PersonalInfoFormData } from '../schemas';

interface PersonalInfoStepProps {
  initialData?: Partial<PersonalInfoFormData>;
  onNext: (data: PersonalInfoFormData) => void;
}

export function PersonalInfoStep({ initialData, onNext }: PersonalInfoStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: initialData,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Personal Information</h2>
        <p className="text-gray-600">Please provide your personal details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* First Name */}
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('firstName')}
            id="firstName"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="John"
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('lastName')}
            id="lastName"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Doe"
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
          )}
        </div>

        {/* Middle Name */}
        <div>
          <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">
            Middle Name
          </label>
          <input
            {...register('middleName')}
            id="middleName"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Michael"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            {...register('dateOfBirth')}
            id="dateOfBirth"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.dateOfBirth && (
            <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
          )}
        </div>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Gender <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              {...register('gender')}
              type="radio"
              value="MALE"
              className="mr-2"
            />
            Male
          </label>
          <label className="flex items-center">
            <input
              {...register('gender')}
              type="radio"
              value="FEMALE"
              className="mr-2"
            />
            Female
          </label>
          <label className="flex items-center">
            <input
              {...register('gender')}
              type="radio"
              value="OTHER"
              className="mr-2"
            />
            Other
          </label>
        </div>
        {errors.gender && (
          <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
        )}
      </div>

      {/* Telephone */}
      <div>
        <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1">
          Telephone <span className="text-red-500">*</span>
        </label>
        <input
          {...register('telephone')}
          id="telephone"
          type="tel"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="+254712345678"
        />
        <p className="mt-1 text-xs text-gray-500">Format: +254XXXXXXXXX</p>
        {errors.telephone && (
          <p className="mt-1 text-sm text-red-600">{errors.telephone.message}</p>
        )}
      </div>

      {/* Email (Optional) */}
      <div>
        <label htmlFor="emailOptional" className="block text-sm font-medium text-gray-700 mb-1">
          Email (Optional)
        </label>
        <input
          {...register('emailOptional')}
          id="emailOptional"
          type="email"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="john.doe@example.com"
        />
        {errors.emailOptional && (
          <p className="mt-1 text-sm text-red-600">{errors.emailOptional.message}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4">
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
