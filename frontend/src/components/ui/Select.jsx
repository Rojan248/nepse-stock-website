import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './Select.css';

const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } }); // Mock event to maintain compatibility
    setIsOpen(false);
  };

  // Find label for current value
  const currentLabel = options.find(opt => (opt.value || opt) === value)?.label ||
    options.find(opt => (opt.value || opt) === value)?.value ||
    value ||
    placeholder;

  // Normalize options to objects
  const normalizedOptions = options.map(opt =>
    typeof opt === 'object' ? opt : { value: opt, label: opt }
  );

  return (
    <div className={`ui-select-wrapper ${className}`} ref={wrapperRef}>
      <div
        className={`ui-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{currentLabel}</span>
        <div className="ui-select-icon">
          <ChevronDown size={14} />
        </div>
      </div>

      {isOpen && (
        <div className="ui-select-dropdown">
          {placeholder && <div className="ui-select-option disabled" style={{ opacity: 0.5 }}>{placeholder}</div>}
          {normalizedOptions.map((option) => (
            <div
              key={option.value}
              className={`ui-select-option ${value === option.value ? 'is-selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Select;
