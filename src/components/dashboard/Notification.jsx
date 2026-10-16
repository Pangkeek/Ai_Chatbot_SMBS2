export default function Notification() {
  return (
    <div
        id="notification"
        className="pointer-events-none fixed top-5 right-5 z-50 hidden w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border bg-white p-4 shadow-xl"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div
            id="notification-icon"
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
          ></div>

          <div className="min-w-0">
            <p id="notification-title" className="font-semibold"></p>

            <p
              id="notification-message"
              className="mt-1 text-sm leading-6 text-slate-600"
            ></p>
          </div>
        </div>
      </div>
  );
}
