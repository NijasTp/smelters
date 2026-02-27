import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Sparkles } from 'lucide-react';

export const Signup: React.FC = () => {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Validate lowercase, alphanumeric + underscore only
    const isValidUsername = (username: string) => {
        const usernameRegex = /^[a-z0-9_]+$/;
        return usernameRegex.test(username);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. Basic Validations
        if (password !== confirmPassword) {
            setError("Passwords do not match 💔");
            setLoading(false);
            return;
        }

        if (!isValidUsername(username)) {
            setError("Username must only contain lowercase letters, numbers, and underscores.");
            setLoading(false);
            return;
        }

        try {
            // 2. Check if username exists (Case-insensitive check implemented on DB level)
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username.toLowerCase())
                .maybeSingle();

            if (existingUser) {
                setError("This lovely username is already taken! 🌸");
                setLoading(false);
                return;
            }
            // If error but it's not "row not found", it's a real error
            if (checkError && checkError.code !== 'PGRST116') {
                console.warn("Error checking username", checkError);
            }

            // 3. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // 4. Create Public User Record
                const { error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: authData.user.id,
                        username: username.toLowerCase(),
                        email: email.toLowerCase()
                    });

                if (profileError) throw profileError;

                // Redirect to feed
                navigate('/');
            }

        } catch (err: any) {
            setError(err.message || 'Something went wrong creating your account.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[90vh] px-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-full max-w-sm bg-white/70 backdrop-blur-md rounded-[2rem] p-8 shadow-soft border border-white/40">
                <div className="flex justify-center mb-6">
                    <div className="bg-primary-pink/20 p-4 rounded-full">
                        <Sparkles className="w-10 h-10 text-primary-pink animate-float" />
                    </div>
                </div>

                <h1 className="font-pacifico text-4xl text-center text-primary-pink mb-2">Join Smelters</h1>
                <p className="text-center text-slate-500 font-quicksand mb-8">Start your romantic journey today</p>

                {error && (
                    <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-6 text-center animate-in slide-in-from-top-2">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 ml-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            className="w-full px-5 py-3 rounded-2xl bg-white/80 border border-transparent focus:border-primary-pink focus:ring-2 focus:ring-primary-pink/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="e.g. lovely_panda"
                            required
                        />
                        <p className="text-xs text-slate-400 ml-2 mt-1">Lowercase, numbers, and underscores only</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 ml-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-5 py-3 rounded-2xl bg-white/80 border border-transparent focus:border-primary-pink focus:ring-2 focus:ring-primary-pink/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="you@email.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 ml-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-5 py-3 rounded-2xl bg-white/80 border border-transparent focus:border-primary-pink focus:ring-2 focus:ring-primary-pink/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="••••••••"
                            minLength={6}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 ml-2">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-5 py-3 rounded-2xl bg-white/80 border border-transparent focus:border-primary-pink focus:ring-2 focus:ring-primary-pink/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="••••••••"
                            minLength={6}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary-pink hover:bg-pink-400 text-white font-semibold py-3 px-6 rounded-2xl shadow-soft transition-all active:scale-95 disabled:opacity-70 flex justify-center mt-6"
                    >
                        {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Create Account"}
                    </button>
                </form>

                <p className="text-center mt-6 text-slate-500 text-sm">
                    Already have an account?{' '}
                    <Link to="/login" className="text-pink-500 font-medium hover:underline hover:text-pink-600 transition-colors">
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    );
};
