'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';

interface LoanDetail {
  id: string;
  loanNumber: string;
  amount: string;
  status: string;
  purpose: string;
  repaymentMonths: number;
  interestRate: string;
  monthlyPayment: string;
  processingFee: string;
  insuranceFee: string;
  disbursementMode: string;
  createdAt: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    memberNumber: string;
    savings: { balance: string }[];
  };
}

export default function LoanDetailsPage() {
  const { id } = useParams();
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) fetchLoanDetails();
  }, [id]);

  const fetchLoanDetails = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/loans/${id}`);
      setLoan(response.data);
    } catch (error) {
      console.error('Error fetching loan details:', error);
      setError('Failed to load loan details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
    
    setProcessingAction(true);
    setError('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await axios.patch(`${apiUrl}/loans/${id}/status`, { status: newStatus });
      fetchLoanDetails(); // Refresh details
    } catch (error: any) {
      console.error('Error updating status:', error);
      setError(error.response?.data?.message || 'Failed to update status');
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!loan) return <div className="p-6">Loan not found</div>;

  const totalSavings = loan.member.savings.reduce((sum, s) => sum + Number(s.balance), 0);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow rounded-lg my-10">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Loan Details: {loan.loanNumber}</h1>
          <p className="text-gray-500">Applied on {format(new Date(loan.createdAt), 'dd MMM yyyy')}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold 
          ${loan.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
            loan.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
            loan.status === 'DISBURSED' ? 'bg-blue-100 text-blue-800' : 
            'bg-yellow-100 text-yellow-800'}`}>
          {loan.status}
        </span>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Member Info */}
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-4">Member Information</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {loan.member.firstName} {loan.member.lastName}</p>
            <p><span className="font-medium">Member No:</span> {loan.member.memberNumber}</p>
            <p><span className="font-medium">Total Savings:</span> KES {totalSavings.toLocaleString()}</p>
          </div>
        </div>

        {/* Loan Info */}
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-4">Loan Information</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Amount:</span> KES {Number(loan.amount).toLocaleString()}</p>
            <p><span className="font-medium">Purpose:</span> {loan.purpose}</p>
            <p><span className="font-medium">Duration:</span> {loan.repaymentMonths} months</p>
            <p><span className="font-medium">Interest Rate:</span> {loan.interestRate}%</p>
            <p><span className="font-medium">Processing Fee:</span> KES {loan.processingFee}</p>
            <p><span className="font-medium">Insurance Fee:</span> KES {loan.insuranceFee}</p>
            <p><span className="font-medium">Disbursement Mode:</span> {loan.disbursementMode}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Actions</h2>
        <div className="flex gap-4">
          {loan.status === 'SUBMITTED' && (
            <button
              onClick={() => handleStatusChange('UNDER_REVIEW')}
              disabled={processingAction}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Start Review
            </button>
          )}

          {loan.status === 'UNDER_REVIEW' && (
            <>
              <button
                onClick={() => handleStatusChange('APPROVED')}
                disabled={processingAction}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                Approve Loan
              </button>
              <button
                onClick={() => handleStatusChange('REJECTED')}
                disabled={processingAction}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                Reject Loan
              </button>
            </>
          )}

          {loan.status === 'APPROVED' && (
            <button
              onClick={() => handleStatusChange('DISBURSED')}
              disabled={processingAction}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400"
            >
              Disburse Funds
            </button>
          )}

          {['DISBURSED', 'REJECTED', 'CLOSED', 'DEFAULTED'].includes(loan.status) && (
            <p className="text-gray-500 italic">No further actions available for this status.</p>
          )}
        </div>
      </div>
    </div>
  );
}
