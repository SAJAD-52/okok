import React from 'react';

export const ListingSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse space-y-4">
      <div className="aspect-[16/10] bg-slate-200 rounded-xl w-full" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-5 bg-slate-200 rounded w-4/5" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-slate-200 rounded-md w-20" />
        <div className="h-6 bg-slate-200 rounded-md w-24" />
      </div>
      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
        <div className="h-6 bg-slate-200 rounded w-28" />
        <div className="h-8 bg-slate-200 rounded-xl w-24" />
      </div>
    </div>
  );
};
