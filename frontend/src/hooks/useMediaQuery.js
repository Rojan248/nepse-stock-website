import { useState, useEffect } from 'react';

export function useMediaQuery(query) {
    const [matches, setMatches] = useState(
        () => window.matchMedia(query).matches
    );

    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = (e) => setMatches(e.matches);

        // Initial check
        setMatches(media.matches);

        // Use addEventListener if available, fallback to deprecated addListener for older browsers/tests
        if (media.addEventListener) {
            media.addEventListener('change', listener);
            return () => media.removeEventListener('change', listener);
        } else {
            // For older browsers or test environments that mock addListener
            media.addListener(listener);
            return () => media.removeListener(listener);
        }
    }, [query]);

    return matches;
}
