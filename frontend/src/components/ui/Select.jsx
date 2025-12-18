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
        className="ui-select"
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
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
};

export default Select;
