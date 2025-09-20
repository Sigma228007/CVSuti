export const dynamic = "force-static";

export default function FkFail() {
  return (
    <main className="min-h-dvh grid place-items-center p-6 text-zinc-100 bg-zinc-950">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">Оплата не прошла</h1>
        <p className="opacity-80">Попробуйте ещё раз. Если проблема повторяется — напишите в поддержку.</p>
      </div>
    </main>
  );
}