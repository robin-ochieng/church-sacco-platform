'use client';

import { useState } from 'react';
import MemberSearch from './components/MemberSearch';
import DepositForm from './components/DepositForm';
import ReceiptPreview from './components/ReceiptPreview';
import { Member, Transaction } from './types';

export default function TellerPage() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setCompletedTransaction(null);
  };

  const handleDepositSuccess = (transaction: Transaction) => {
    setCompletedTransaction(transaction);
  };

  const handleNewDeposit = () => {
    setSelectedMember(null);
    setCompletedTransaction(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manual Deposit - Teller Interface
          </h1>
          <p className="text-gray-600">
            Process cash, mobile money, and bank deposits for SACCO members
          </p>
        </div>

        {!completedTransaction ? (
          <>
            {/* Member Search Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Step 1: Find Member
              </h2>
              <MemberSearch onMemberSelect={handleMemberSelect} />
            </div>

            {/* Deposit Form Section */}
            {selectedMember && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Step 2: Record Deposit
                </h2>
                
                {/* Selected Member Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Selected Member</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedMember.firstName} {selectedMember.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Member #: {selectedMember.memberNumber}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedMember(null)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Change Member
                    </button>
                  </div>
                </div>

                <DepositForm
                  member={selectedMember}
                  onSuccess={handleDepositSuccess}
                  onCancel={() => setSelectedMember(null)}
                />
              </div>
            )}
          </>
        ) : (
          <ReceiptPreview
            transaction={completedTransaction}
            onNewDeposit={handleNewDeposit}
          />
        )}
      </div>
    </main>
  );
}
