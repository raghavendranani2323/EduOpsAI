import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-28" />
      </div>
      <div className="rounded-2xl border border-border p-4 space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-11" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
