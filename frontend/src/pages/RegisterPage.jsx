import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const REGISTER_FIELDS = [
    {
        id: 'displayName',
        label: 'Display Name (optional)',
        placeholder: 'Your name',
        type: 'text',
    },
    {
        id: 'email',
        label: 'Email',
        placeholder: 'you@example.com',
        type: 'email',
        required: true,
    },
    {
        id: 'password',
        label: 'Password',
        placeholder: 'At least 8 characters',
        type: 'password',
        required: true,
        minLength: 8,
    },
];

const createInitialForm = () => ({
    displayName: '',
    email: '',
    password: '',
});

const getRegistrationError = (error) => (
    error.response?.data?.error?.message || 'Registration failed'
);

const getDisplayNamePayload = (displayName) => displayName || undefined;

function useRegisterForm(register, navigate) {
    const [form, setForm] = useState(createInitialForm);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const updateField = (field) => (event) => {
        setForm((current) => ({
            ...current,
            [field]: event.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register(form.email, form.password, getDisplayNamePayload(form.displayName));
            navigate('/');
        } catch (err) {
            setError(getRegistrationError(err));
        } finally {
            setLoading(false);
        }
    };

    return {
        error,
        form,
        handleSubmit,
        loading,
        updateField,
    };
}

const RegisterError = ({ message }) => (
    message ? <div className="auth-error">{message}</div> : null
);

const RegisterField = ({ field, value, onChange }) => (
    <div className="form-group">
        <label htmlFor={field.id}>{field.label}</label>
        <input
            id={field.id}
            type={field.type}
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
            required={field.required}
            minLength={field.minLength}
        />
    </div>
);

const RegisterForm = ({ form, loading, onFieldChange, onSubmit }) => (
    <form onSubmit={onSubmit} className="auth-form">
        {REGISTER_FIELDS.map((field) => (
            <RegisterField
                key={field.id}
                field={field}
                value={form[field.id]}
                onChange={onFieldChange(field.id)}
            />
        ))}
        <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
        </button>
    </form>
);

function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const {
        error,
        form,
        handleSubmit,
        loading,
        updateField,
    } = useRegisterForm(register, navigate);

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1 className="auth-title">Create Account</h1>
                <p className="auth-subtitle">Join NEPSE Market</p>

                <RegisterError message={error} />
                <RegisterForm
                    form={form}
                    loading={loading}
                    onFieldChange={updateField}
                    onSubmit={handleSubmit}
                />

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}

export default RegisterPage;
