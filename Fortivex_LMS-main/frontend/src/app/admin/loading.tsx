import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/4 rounded-lg" />
        <Skeleton className="h-4 w-1/3 rounded-md" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
      
      <div className="mt-8">
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
