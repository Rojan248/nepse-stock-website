import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for scroll-triggered reveal animations
 * Elements start visible to prevent flash of hidden content
 * Animation only triggers for elements initially below the fold
 * @param {number} threshold - Visibility threshold (0-1)
 * @returns {{ ref: React.RefObject, isVisible: boolean }}
 */
export function useScrollReveal(threshold = 0.1) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(true); // Start visible!

    useEffect(() => {
        const currentRef = ref.current;
        if (!currentRef) return;

        // Check if element is below the viewport on initial load
        const rect = currentRef.getBoundingClientRect();
        const isAboveFold = rect.top < window.innerHeight;

        if (isAboveFold) {
            // Already visible, keep it visible
            setIsVisible(true);
            return;
        }

        // Element is below fold, set up animation
        setIsVisible(false);

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold, rootMargin: '50px 0px 0px 0px' }
        );

        observer.observe(currentRef);

        return () => observer.disconnect();
    }, [threshold]);

    return { ref, isVisible };
}

export default useScrollReveal;
