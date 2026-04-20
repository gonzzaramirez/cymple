import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-[420px] space-y-6 px-4">
        <div className="text-center space-y-2">
          <Skeleton className="mx-auto h-10 w-36" />
          <Skeleton className="mx-auto h-4 w-64" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </main>
  );
}
