import { InputHTMLAttributes, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  validateOnBlur?: boolean;
  validator?: (value: string) => { valid: boolean; error?: string };
}

export function Input({ 
  label, 
  error, 
  className, 
  validateOnBlur = false, 
  validator,
  onBlur,
  type,
  ...props 
}: InputProps) {
  const [localError, setLocalError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (validateOnBlur && validator) {
      const result = validator(e.target.value);
      if (!result.valid && result.error) {
        setLocalError(result.error);
      } else {
        setLocalError('');
      }
    }
    onBlur?.(e);
  };

  const displayError = error || localError;
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={inputType}
          className={cn(
            'w-full px-4 py-2 border rounded-lg',
            'bg-white dark:bg-gray-800',
            'text-gray-900 dark:text-white',
            'placeholder-gray-400 dark:placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed',
            'transition-all duration-200',
            displayError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600',
            isPassword ? 'pr-10' : '',
            className
          )}
          onBlur={handleBlur}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        )}
        {displayError && !isPassword && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertCircle className="text-red-500" size={18} />
          </div>
        )}
        {displayError && isPassword && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <AlertCircle className="text-red-500" size={18} />
          </div>
        )}
      </div>
      <AnimatePresence>
        {displayError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {displayError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
