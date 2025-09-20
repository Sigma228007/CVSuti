export const dynamic = "force-static";

export default function FkSuccess() {
  return (
    <main className="min-h-dvh grid place-items-center p-6 text-zinc-100 bg-zinc-950">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">Оплата принята</h1>
        <p className="opacity-80">
          Спасибо! Можете закрыть эту страницу. В Telegram перезапустите мини-приложение,
          чтобы обновить баланс.
        </p>
      </div>
    </main>
  );
}