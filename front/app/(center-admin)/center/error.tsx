"use client";

export default function CenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Ocurrio un error al cargar esta pagina
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        {error.message}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Reintentar
      </button>
    </div>
  );
}
