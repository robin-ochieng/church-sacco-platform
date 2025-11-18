'use client';

import { useState, useCallback } from 'react';
import { Member } from '../types';
import { searchMembers } from '../api';
import { debounce } from '../utils';

interface MemberSearchProps {
  onMemberSelect: (member: Member) => void;
}

export default function MemberSearch({ onMemberSelect }: MemberSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const results = await searchMembers(query);
        setSearchResults(results);
        setShowResults(true);
      } catch (err) {
        setError('Failed to search members. Please try again.');
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    performSearch(value);
  };

  const handleSelectMember = (member: Member) => {
    onMemberSelect(member);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <label htmlFor="member-search" className="block text-sm font-medium text-gray-700 mb-2">
        Search by Name, Phone, or Member Number
      </label>
      
      <div className="relative">
        <input
          id="member-search"
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Start typing to search..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoComplete="off"
        />
        
        {isSearching && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {searchResults.map((member) => (
            <button
              key={member.id}
              onClick={() => handleSelectMember(member)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {member.memberNumber} • {member.phoneNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    {member.email}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && searchResults.length === 0 && !isSearching && searchQuery.length >= 2 && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-600">
          No members found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}
