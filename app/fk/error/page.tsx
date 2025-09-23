export const dynamic = "force-static";

export default function FkError() {
  return (
    <main className="min-h-dvh grid place-items-center p-6 text-zinc-100 bg-zinc-950">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">❌ Ошибка оплаты</h1>
        <p className="opacity-80 mb-4">
          При обработке платежа произошла ошибка.
        </p>
        <p className="text-sm opacity-60">
          Пожалуйста, попробуйте ещё раз или обратитесь в поддержку.<br/>
          Если средства были списаны - они вернутся в течение 24 часов.
        </p>
        
        <div className="mt-6">
          <button 
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Закрыть страницу
          </button>
        </div>
      </div>
    </main>
  );
}