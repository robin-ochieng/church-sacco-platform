'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export interface EligibleGuarantor {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string;
  totalSharesValue: number;
  existingExposure: number;
  availableCapacity: number;
  isEligible: boolean;
}

export interface SelectedGuarantor {
  guarantorMemberId: string;
  amountGuaranteed: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
  availableCapacity: number;
}

interface GuarantorSelectionProps {
  loanId: string;
  loanAmount: number;
  selectedGuarantors: SelectedGuarantor[];
  onGuarantorsChange: (guarantors: SelectedGuarantor[]) => void;
  minGuarantors?: number;
  apiUrl?: string;
}

export function GuarantorSelection({
  loanId,
  loanAmount,
  selectedGuarantors,
  onGuarantorsChange,
  minGuarantors = 2,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
}: GuarantorSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [eligibleGuarantors, setEligibleGuarantors] = useState<EligibleGuarantor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountInputs, setAmountInputs] = useState<Record<string, number>>({});

  // Calculate total guaranteed amount
  const totalGuaranteed = selectedGuarantors.reduce(
    (sum, g) => sum + g.amountGuaranteed,
    0
  );
  const remainingAmount = loanAmount - totalGuaranteed;

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch eligible guarantors
  const fetchEligibleGuarantors = useCallback(
    async (search: string) => {
      if (!loanId) return;
      
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(
          `${apiUrl}/loans/${loanId}/guarantors/eligible`,
          { params: { search } }
        );
        setEligibleGuarantors(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch eligible guarantors');
      } finally {
        setIsLoading(false);
      }
    },
    [loanId, apiUrl]
  );

  // Fetch when debounced search query changes (initial fetch happens because debouncedSearchQuery starts as '')
  useEffect(() => {
    fetchEligibleGuarantors(debouncedSearchQuery);
  }, [debouncedSearchQuery, fetchEligibleGuarantors]);

  const handleAddGuarantor = (guarantor: EligibleGuarantor) => {
    const amount = amountInputs[guarantor.id] || 0;
    
    if (amount <= 0) {
      setError('Please enter a valid amount to guarantee');
      return;
    }

    if (amount > guarantor.availableCapacity) {
      setError(`Amount exceeds guarantor's available capacity (${formatCurrency(guarantor.availableCapacity)})`);
      return;
    }

    if (amount > remainingAmount) {
      setError(`Amount exceeds remaining loan amount (${formatCurrency(remainingAmount)})`);
      return;
    }

    const newGuarantor: SelectedGuarantor = {
      guarantorMemberId: guarantor.id,
      amountGuaranteed: amount,
      firstName: guarantor.firstName,
      lastName: guarantor.lastName,
      memberNumber: guarantor.memberNumber,
      availableCapacity: guarantor.availableCapacity,
    };

    onGuarantorsChange([...selectedGuarantors, newGuarantor]);
    setAmountInputs({ ...amountInputs, [guarantor.id]: 0 });
    setError(null);
  };

  const handleRemoveGuarantor = (memberId: string) => {
    onGuarantorsChange(selectedGuarantors.filter(g => g.guarantorMemberId !== memberId));
  };

  const handleAmountChange = (guarantorId: string, value: number) => {
    setAmountInputs({ ...amountInputs, [guarantorId]: value });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  // Check if a member is already selected
  const isSelected = (memberId: string) => {
    return selectedGuarantors.some(g => g.guarantorMemberId === memberId);
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Guarantee Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Loan Amount:</span>
            <p className="font-semibold text-gray-900">{formatCurrency(loanAmount)}</p>
          </div>
          <div>
            <span className="text-gray-600">Total Guaranteed:</span>
            <p className={`font-semibold ${totalGuaranteed >= loanAmount ? 'text-green-600' : 'text-orange-600'}`}>
              {formatCurrency(totalGuaranteed)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Remaining:</span>
            <p className={`font-semibold ${remainingAmount <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(remainingAmount)}
            </p>
          </div>
        </div>
        <div className="mt-2 text-sm">
          <span className="text-gray-600">Guarantors Selected:</span>
          <span className={`ml-2 font-semibold ${selectedGuarantors.length >= minGuarantors ? 'text-green-600' : 'text-orange-600'}`}>
            {selectedGuarantors.length} / {minGuarantors} minimum
          </span>
        </div>
      </div>

      {/* Selected Guarantors */}
      {selectedGuarantors.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Selected Guarantors</h3>
          <div className="space-y-2">
            {selectedGuarantors.map((guarantor) => (
              <div
                key={guarantor.guarantorMemberId}
                className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {guarantor.firstName} {guarantor.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{guarantor.memberNumber}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-green-700">
                    {formatCurrency(guarantor.amountGuaranteed)}
                  </span>
                  <button
                    onClick={() => handleRemoveGuarantor(guarantor.guarantorMemberId)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Add Guarantors */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Find Eligible Guarantors</h3>
        
        {/* Search Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or member number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-4 text-gray-500">Loading eligible guarantors...</div>
        )}

        {/* Eligible Guarantors List */}
        {!isLoading && eligibleGuarantors.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No eligible guarantors found. Members must be active for at least 12 months with available share capacity.
          </div>
        )}

        {!isLoading && eligibleGuarantors.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {eligibleGuarantors.map((guarantor) => (
              <div
                key={guarantor.id}
                className={`border rounded-lg p-3 ${
                  isSelected(guarantor.id)
                    ? 'bg-gray-100 border-gray-300 opacity-60'
                    : 'bg-white border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {guarantor.firstName} {guarantor.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{guarantor.memberNumber}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Available Capacity: <span className="font-medium text-green-600">{formatCurrency(guarantor.availableCapacity)}</span>
                    </p>
                  </div>
                  
                  {!isSelected(guarantor.id) && remainingAmount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={amountInputs[guarantor.id] || ''}
                          onChange={(e) => handleAmountChange(guarantor.id, Number(e.target.value))}
                          min={1}
                          max={Math.min(guarantor.availableCapacity, remainingAmount)}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-1 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => handleAddGuarantor(guarantor)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                      >
                        Add
                      </button>
                    </div>
                  )}
                  
                  {isSelected(guarantor.id) && (
                    <span className="text-green-600 text-sm font-medium">✓ Selected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Messages */}
      {selectedGuarantors.length < minGuarantors && (
        <p className="text-sm text-orange-600">
          ⚠️ Please select at least {minGuarantors} guarantors
        </p>
      )}
      {remainingAmount > 0 && (
        <p className="text-sm text-orange-600">
          ⚠️ Total guaranteed amount must cover the full loan amount
        </p>
      )}
    </div>
  );
}

export default GuarantorSelection;
