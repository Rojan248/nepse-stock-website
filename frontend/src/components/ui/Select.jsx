import React from 'react';
import './Select.css';

const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
  ...props
}) => {
  return (
    <div className={`ui-select-wrapper ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="ui-select-input"
        {...props}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
      <div className="ui-select-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  );
};

export default Select;
