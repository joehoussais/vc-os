import { useEffect, useState } from 'react';

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
      className={`fixed bottom-6 right-6 bg-gray-800 text-white px-5 py-3 rounded-lg shadow-lg transition-all duration-300 z-50 ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'
      }`}
    >
      {message}
    </div>
  );
}
