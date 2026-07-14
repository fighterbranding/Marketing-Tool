'use client';
import { useState } from 'react';
import { useTargetingSearch } from '@/lib/hooks/use-targeting-search';
import type { TargetingInterest } from '@/lib/types';

interface InterestPickerProps {
  value: TargetingInterest[];
  onChange: (value: TargetingInterest[]) => void;
}

export function InterestPicker({ value, onChange }: InterestPickerProps) {
  const [query, setQuery] = useState('');
  const { data: suggestions, isFetching } = useTargetingSearch(query);
  const selectedIds = new Set(value.map((i) => i.id));
  const showDropdown = query.trim().length > 2;

  function addInterest(interest: TargetingInterest) {
    onChange([...value, interest]);
    setQuery('');
  }

  function removeInterest(id: string) {
    onChange(value.filter((i) => i.id !== id));
  }

  const unselectedSuggestions = suggestions?.filter((s) => !selectedIds.has(s.id)) ?? [];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Interests</label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search interests (e.g. Fitness)"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {showDropdown && (
        <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-auto">
          {isFetching && <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>}
          {!isFetching && unselectedSuggestions.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
          )}
          {unselectedSuggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => addInterest(s)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((i) => (
            <span
              key={i.id}
              className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full"
            >
              {i.name}
              <button
                type="button"
                onClick={() => removeInterest(i.id)}
                aria-label={`Remove ${i.name}`}
                className="hover:text-indigo-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
