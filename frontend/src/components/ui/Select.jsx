import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './Select.css';

const normalizeOption = (option) =>
  typeof option === 'object' ? option : { value: option, label: option };

const resolveOptionValue = (option) => option.value || option;

const resolveCurrentLabel = (options, value, placeholder) => {
  const selected = options.find(opt => resolveOptionValue(opt) === value);
  return selected?.label || selected?.value || value || placeholder;
};

const useOutsideClick = (wrapperRef, onOutsideClick) => {
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        onOutsideClick();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, onOutsideClick]);
};

function SelectDropdown({ placeholder, options, value, onSelect }) {
  return (
    <div className="ui-select-dropdown">
      {placeholder && <div className="ui-select-option disabled" style={{ opacity: 0.5 }}>{placeholder}</div>}
      {options.map((option) => (
        <div
          key={option.value}
          className={`ui-select-option ${value === option.value ? 'is-selected' : ''}`}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
}

const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useOutsideClick(wrapperRef, () => setIsOpen(false));

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } }); // Mock event to maintain compatibility
    setIsOpen(false);
  };

  const currentLabel = resolveCurrentLabel(options, value, placeholder);
  const normalizedOptions = options.map(normalizeOption);

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

      {isOpen && <SelectDropdown placeholder={placeholder} options={normalizedOptions} value={value} onSelect={handleSelect} />}
    </div>
  );
};

export default Select;
