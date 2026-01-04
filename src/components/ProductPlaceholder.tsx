import React from 'react';

interface ProductPlaceholderProps {
  className?: string;
}

export const ProductPlaceholder: React.FC<ProductPlaceholderProps> = ({ className = "" }) => {
  return (
    <div 
      className={`flex items-center justify-center rounded-lg w-full h-full min-h-[12rem] bg-emerald-50 border border-emerald-200/50 shadow-sm ${className}`}
      data-testid="product_placeholder"
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[85%] h-[85%] max-w-[32rem] max-h-[32rem] text-emerald-700/40"
        data-testid="product_placeholder_icon"
      >
        {/* Карточка товара: рамка */}
        <rect
          x="15"
          y="25"
          width="90"
          height="70"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Изображение товара слева */}
        <rect
          x="22"
          y="35"
          width="40"
          height="32"
          rx="4"
          fill="currentColor"
          fillOpacity="0.08"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Псевдо-изображение: горы + солнце */}
        <path
          d="M26 58 L33 52 L40 58 L47 50 L54 58"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="30" cy="45" r="3" fill="currentColor" fillOpacity="0.5" />

        {/* Заголовок справа */}
        <rect x="66" y="38" width="32" height="6" rx="3" fill="currentColor" fillOpacity="0.2" />
        {/* Подзаголовки/описание */}
        <rect x="66" y="48" width="24" height="5" rx="2" fill="currentColor" fillOpacity="0.15" />
        <rect x="66" y="58" width="28" height="5" rx="2" fill="currentColor" fillOpacity="0.15" />

        {/* Цена/бейдж справа внизу */}
        <rect x="66" y="74" width="32" height="12" rx="6" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M78 80 h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
};