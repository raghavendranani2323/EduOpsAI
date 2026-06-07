import { Skeleton } from "@/components/ui/skeleton";

export default function TimetableLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
