import React from 'react';
import './Skeleton.css';

/**
 * Skeleton loading placeholder
 * @param {Object} props
 * @param {string} props.variant - 'text' | 'rectangular' | 'circular'
 * @param {string|number} props.width - Width of the skeleton
 * @param {string|number} props.height - Height of the skeleton
 * @param {string} props.className - Additional classes
 */
const Skeleton = ({ variant = 'text', width, height, className = '', style = {} }) => {
    const styles = {
        width,
        height,
        ...style
    };

    return (
        <div
            className={`skeleton skeleton-${variant} ${className}`}
            style={styles}
            aria-hidden="true"
        />
    );
};

export default Skeleton;
