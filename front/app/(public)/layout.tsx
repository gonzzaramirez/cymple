import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col font-sans antialiased">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        {children}
      </main>
    </div>
  );
}
