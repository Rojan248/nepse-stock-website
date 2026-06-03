import React from 'react';
import './Button.css';

const buttonStateFlag = (isActive) => (isActive ? 'true' : undefined);

const isButtonDisabled = (disabled, loading) => disabled || loading;

const getButtonClassName = ({
  buttonClass,
  className,
  icon,
  loading,
  size,
  variant,
}) => [
  'ui-btn',
  `btn-${variant}`,
  `btn-${size}`,
  `btn-${buttonClass}`,
  icon ? 'btn-has-icon' : '',
  loading ? 'btn-loading' : '',
  className,
].filter(Boolean).join(' ');

const LoadingIndicator = ({ loading }) => {
  if (!loading) return null;

  return (
    <span className="btn-spinner" role="status" aria-hidden="false">
      <span className="sr-only">Loading...</span>
    </span>
  );
};

const ButtonIcon = ({ icon }) => (
  icon ? <span className="btn-icon">{icon}</span> : null
);

const ButtonContent = ({ children }) => (
  children ? <span className="btn-content">{children}</span> : null
);

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
  type,
  ...props
}, ref) => {
  const buttonDisabled = isButtonDisabled(disabled, loading);
  const buttonClassName = getButtonClassName({
    buttonClass,
    className,
    icon,
    loading,
    size,
    variant,
  });

  return (
    <button
      ref={ref}
      type={type || 'button'}
      className={buttonClassName}
      disabled={buttonDisabled}
      aria-busy={buttonStateFlag(loading)}
      aria-disabled={buttonStateFlag(buttonDisabled)}
      {...props}
    >
      <LoadingIndicator loading={loading} />
      <ButtonIcon icon={icon} />
      <ButtonContent>{children}</ButtonContent>
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
