import { useEffect } from 'react';

export default function Toast({ message, show, onHide }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onHide();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50
        bg-[var(--bg-primary)] border border-[var(--border-color)]
        text-[var(--text-primary)]
        px-4 py-3 rounded-lg shadow-lg
        flex items-center gap-3
        transition-all duration-300 ease-out
        ${show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}
      `}
    >
      {/* Success check icon */}
      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
