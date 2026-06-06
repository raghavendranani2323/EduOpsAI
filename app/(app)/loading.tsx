export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl animate-pulse">
      <div className="h-6 w-32 bg-muted rounded" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted/60 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
