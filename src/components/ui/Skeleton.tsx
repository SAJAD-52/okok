import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-steel-200/80 rounded-xl ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

export default Skeleton;
