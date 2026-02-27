import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';

export const Login: React.FC = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let loginEmail = identifier;

            // If it doesn't look like an email, assume it's a username
            if (!identifier.includes('@')) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('email' as any)
                    .eq('username', identifier.toLowerCase())
                    .maybeSingle();

                if (userError) throw userError;

                if (!(userData as any)) {
                    throw new Error("Username not found ☁️");
                }

                if (!(userData as any).email) {
                    throw new Error("Username found but email is missing in profile. Please login with email first to sync. 🌸");
                }
                loginEmail = (userData as any).email;
            }

            const { error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password,
            });

            if (authError) throw authError;

            navigate('/');
            toast.success("Welcome back! ✨");
        } catch (err: any) {
            toast.error(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
            <div className="w-full max-w-sm bg-white/70 backdrop-blur-md rounded-[2rem] p-8 shadow-soft border border-white/40">
                <div className="flex justify-center mb-6">
                    <div className="bg-primary-pink/20 p-4 rounded-full">
                        <Heart className="w-10 h-10 text-primary-pink animate-pulse" fill="currentColor" />
                    </div>
                </div>

                <h1 className="font-pacifico text-4xl text-center text-primary-pink mb-2">Welcome Back</h1>
                <p className="text-center text-slate-500 font-quicksand mb-8">Login to your digital scrapbook</p>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 ml-2">Email or Username</label>
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full px-5 py-3 rounded-2xl bg-white/80 border border-transparent focus:border-primary-pink focus:ring-2 focus:ring-primary-pink/20 outline-none transition-all placeholder:text-slate-400"
                            placeholder="you@example.com or username"
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
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary-pink hover:bg-pink-400 text-white font-semibold py-3 px-6 rounded-2xl shadow-soft transition-all active:scale-95 disabled:opacity-70 flex justify-center mt-4"
                    >
                        {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Login"}
                    </button>
                </form>

                <p className="text-center mt-6 text-slate-500 text-sm">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-pink-500 font-medium hover:underline hover:text-pink-600 transition-colors">
                        Sign up directly
                    </Link>
                </p>
            </div>
        </div>
    );
};
