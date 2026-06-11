export const PUBLIC_REGISTRATION_ENABLED = (
    import.meta.env.DEV
    || import.meta.env.VITE_PUBLIC_REGISTRATION_ENABLED === 'true'
);
