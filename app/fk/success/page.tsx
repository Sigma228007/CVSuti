export const dynamic = "force-static";

export default function FkSuccess() {
  return (
    <main className="min-h-dvh grid place-items-center p-6 text-zinc-100 bg-zinc-950">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">✅ Оплата принята</h1>
        <p className="opacity-80 mb-4">
          Спасибо за оплату! Платёж обрабатывается системой.
        </p>
        <p className="text-sm opacity-60">
          Баланс будет пополнен автоматически в течение 1-2 минут.<br/>
          Вы можете закрыть эту страницу и вернуться в приложение.
        </p>
        
        <div className="mt-6">
          <button 
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Закрыть страницу
          </button>
        </div>
      </div>
    </main>
  );
}