import React from 'react';
import './Button.css';

/**
 * Unified Button Component
 * 
 * @param {Object} props
 * @param {string} props.variant - "primary", "secondary", "outline", "ghost", "danger", "link"
 * @param {string} props.size - "sm", "md", "lg", "icon"
 * @param {string} props.buttonClass - "standard", "square", "circle"
 * @param {React.ReactNode} props.icon - Optional icon component
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Button content
 */
const Button = React.forwardRef(({
  variant = 'primary',
  size = 'md',
  buttonClass = 'standard',
  icon,
  loading = false,
  disabled = false,
  className = '',
  children,
  type, // allow overriding type via props
  ...props
}, ref) => {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  const shapeClass = `btn-${buttonClass}`;
  const hasIconClass = icon ? 'btn-has-icon' : '';
  const loadingClass = loading ? 'btn-loading' : '';

  return (
    <button
      ref={ref}
      type={type || 'button'}
      className={`ui-btn ${variantClass} ${sizeClass} ${shapeClass} ${hasIconClass} ${loadingClass} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      aria-disabled={disabled || loading ? 'true' : undefined}
      {...props}
    >
      {loading && (
        <span className="btn-spinner" role="status" aria-hidden="false">
          <span className="sr-only">Loading…</span>
        </span>
      )}
      {icon && <span className="btn-icon">{icon}</span>}
      {children && <span className="btn-content">{children}</span>}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
