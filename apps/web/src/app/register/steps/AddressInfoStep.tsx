'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addressInfoSchema, type AddressInfoFormData } from '../schemas';

interface AddressInfoStepProps {
  initialData?: Partial<AddressInfoFormData>;
  onNext: (data: AddressInfoFormData) => void;
  onBack: () => void;
}

export function AddressInfoStep({ initialData, onNext, onBack }: AddressInfoStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressInfoFormData>({
    resolver: zodResolver(addressInfoSchema),
    defaultValues: initialData,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Address & Church Group</h2>
        <p className="text-gray-600">Please provide your address and church details</p>
      </div>

      {/* Physical Address */}
      <div>
        <label htmlFor="physicalAddress" className="block text-sm font-medium text-gray-700 mb-1">
          Physical Address <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('physicalAddress')}
          id="physicalAddress"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="123 Main Street, Nairobi"
        />
        {errors.physicalAddress && (
          <p className="mt-1 text-sm text-red-600">{errors.physicalAddress.message}</p>
        )}
      </div>

      {/* P.O. Box */}
      <div>
        <label htmlFor="poBox" className="block text-sm font-medium text-gray-700 mb-1">
          P.O. Box
        </label>
        <input
          {...register('poBox')}
          id="poBox"
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="P.O. Box 12345"
        />
      </div>

      {/* Church Group */}
      <div>
        <label htmlFor="churchGroup" className="block text-sm font-medium text-gray-700 mb-1">
          Church Group
        </label>
        <input
          {...register('churchGroup')}
          id="churchGroup"
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Youth Fellowship"
        />
        <p className="mt-1 text-xs text-gray-500">Optional: Your church group or ministry</p>
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
