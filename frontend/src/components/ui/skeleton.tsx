import React from "react";
import { cn } from "../../lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-hidden rounded-md bg-slate-200 before:absolute before:inset-0 animate-pulse before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:content-['']",
      className,
    )}
    {...props}
  />
));

Skeleton.displayName = "Skeleton";

interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(({ className, lines = 3, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn("h-4 rounded", i === lines - 1 && "w-4/5")} />
    ))}
  </div>
));

SkeletonText.displayName = "SkeletonText";

type SkeletonCardProps = React.HTMLAttributes<HTMLDivElement>;

export const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-4 rounded-lg border border-slate-200 bg-white p-4", className)}
    {...props}
  >
    <Skeleton className="h-5 w-2/3" />
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-2 w-full rounded-full" />
    <div className="flex gap-2 pt-2">
      <Skeleton className="h-9 flex-1 rounded" />
      <Skeleton className="h-9 flex-1 rounded" />
    </div>
  </div>
));

SkeletonCard.displayName = "SkeletonCard";
