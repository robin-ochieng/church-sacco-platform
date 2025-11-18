'use client';

import { useState } from 'react';
import { Member, TransactionType, TransactionChannel, DepositFormData } from '../types';
import { createDeposit } from '../api';

interface DepositFormProps {
  member: Member;
  onSuccess: (transaction: any) => void;
  onCancel: () => void;
}

const TRANSACTION_TYPES = [
  { value: TransactionType.SAVINGS_DEPOSIT, label: 'Savings Deposit' },
  { value: TransactionType.SHARES_DEPOSIT, label: 'Shares Deposit' },
  { value: TransactionType.SPECIAL_CONTRIBUTION, label: 'Special Contribution' },
];

const CHANNELS = [
  { value: TransactionChannel.CASH, label: 'Cash', icon: '💵' },
  { value: TransactionChannel.MOBILE_MONEY, label: 'Mobile Money (M-Pesa)', icon: '📱' },
  { value: TransactionChannel.BANK_TRANSFER, label: 'Bank Transfer', icon: '🏦' },
  { value: TransactionChannel.CHEQUE, label: 'Cheque', icon: '📝' },
];

export default function DepositForm({ member, onSuccess, onCancel }: DepositFormProps) {
  const [formData, setFormData] = useState<DepositFormData>({
    amount: '',
    transactionType: TransactionType.SAVINGS_DEPOSIT,
    channel: TransactionChannel.CASH,
    reference: '',
    narration: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate amount
    const amount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amount)) {
      newErrors.amount = 'Amount is required';
    } else if (amount <= 0) {
      newErrors.amount = 'Amount must be greater than zero';
    } else if (!/^\d+(\.\d{1,2})?$/.test(formData.amount)) {
      newErrors.amount = 'Amount must have at most 2 decimal places';
    }

    // Validate reference for non-cash channels
    if (formData.channel !== TransactionChannel.CASH && !formData.reference.trim()) {
      newErrors.reference = `Reference number is required for ${CHANNELS.find(c => c.value === formData.channel)?.label}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const transaction = await createDeposit({
        memberId: member.id,
        amount: parseFloat(formData.amount),
        transactionType: formData.transactionType,
        channel: formData.channel,
        reference: formData.reference || undefined,
        narration: formData.narration || undefined,
      });

      onSuccess(transaction);
    } catch (error: any) {
      setErrors({
        submit: error.response?.data?.message || 'Failed to create deposit. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and up to 2 decimal places
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setFormData({ ...formData, amount: value });
      if (errors.amount) {
        setErrors({ ...errors, amount: '' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Input */}
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
          Amount (KES) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-3 text-gray-500 font-medium">KES</span>
          <input
            id="amount"
            type="text"
            value={formData.amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            className={`w-full pl-16 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold ${
              errors.amount ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
        </div>
        {errors.amount && (
          <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
        )}
      </div>

      {/* Transaction Type */}
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
          Transaction Type <span className="text-red-500">*</span>
        </label>
        <select
          id="type"
          value={formData.transactionType}
          onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as TransactionType })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSubmitting}
        >
          {TRANSACTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Channel */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Channel <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {CHANNELS.map((channel) => (
            <button
              key={channel.value}
              type="button"
              onClick={() => setFormData({ ...formData, channel: channel.value })}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                formData.channel === channel.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              disabled={isSubmitting}
            >
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{channel.icon}</span>
                <span className="font-medium text-gray-900">{channel.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reference Number */}
      <div>
        <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
          Reference Number {formData.channel !== TransactionChannel.CASH && <span className="text-red-500">*</span>}
        </label>
        <input
          id="reference"
          type="text"
          value={formData.reference}
          onChange={(e) => {
            setFormData({ ...formData, reference: e.target.value });
            if (errors.reference) {
              setErrors({ ...errors, reference: '' });
            }
          }}
          placeholder={
            formData.channel === TransactionChannel.MOBILE_MONEY
              ? 'e.g., RKJ8X9P2QW'
              : formData.channel === TransactionChannel.BANK_TRANSFER
              ? 'e.g., TXN-BANK-456789'
              : formData.channel === TransactionChannel.CHEQUE
              ? 'e.g., CHQ-123456'
              : 'Optional reference'
          }
          maxLength={50}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.reference ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        />
        {errors.reference && (
          <p className="mt-1 text-sm text-red-600">{errors.reference}</p>
        )}
      </div>

      {/* Narration */}
      <div>
        <label htmlFor="narration" className="block text-sm font-medium text-gray-700 mb-2">
          Narration / Notes
        </label>
        <textarea
          id="narration"
          value={formData.narration}
          onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
          placeholder="Optional description or notes about this deposit..."
          maxLength={280}
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={isSubmitting}
        />
        <p className="mt-1 text-sm text-gray-500 text-right">
          {formData.narration.length}/280
        </p>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Processing...
            </>
          ) : (
            'Submit Deposit'
          )}
        </button>
      </div>
    </form>
  );
}
