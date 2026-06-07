import { Skeleton } from "@/components/ui/skeleton";

export default function AcademicYearLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-24" />
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
