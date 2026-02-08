import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Seleccionar...', 
  className = '' 
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Obtener el label de la opción seleccionada
  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Cerrar con tecla ESC
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Botón principal */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left bg-white text-secondary-900 border border-secondary-300 rounded-lg 
                   hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 
                   transition-colors flex items-center justify-between"
      >
        <span className={value ? 'text-secondary-900' : 'text-secondary-500'}>
          {selectedLabel}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-secondary-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white text-secondary-900 border border-secondary-300 rounded-lg 
                        shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-2 text-left transition-colors
                ${value === option.value 
                  ? 'bg-primary-50 text-primary-700 font-medium' 
                  : 'text-secondary-700 hover:bg-secondary-50'
                }
                first:rounded-t-lg last:rounded-b-lg
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
