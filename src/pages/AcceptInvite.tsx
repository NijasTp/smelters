import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { HeartHandshake, AlertCircle, Home } from 'lucide-react';

export const AcceptInvite: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!user) {
            // If user is not logged in, they should be redirected by ProtectedRoute
            // But just in case, save intent? Simple version: just redirect.
            navigate('/login');
            return;
        }

        if (token) {
            handleAcceptInvite();
        }
    }, [user, token]);

    const handleAcceptInvite = async () => {
        try {
            setLoading(true);
            setError(null);

            // Call the secure RPC function
            const { error: rpcError } = await supabase.rpc('accept_invite_link', {
                p_token: token!
            });

            if (rpcError) {
                throw new Error(rpcError.message || "Failed to accept invite");
            }

            setSuccess(true);

            // Redirect home after a few seconds
            setTimeout(() => {
                navigate('/');
            }, 3000);

        } catch (err: any) {
            console.error("Invite error", err);
            setError(err.message || "This invite link is invalid, expired, or you already have a partner.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
            <div className="w-full max-w-sm bg-white/70 backdrop-blur-md rounded-[2.5rem] p-8 shadow-soft border border-white/40 text-center">

                {loading ? (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-primary-pink border-t-soft-blush rounded-full animate-spin mb-4"></div>
                        <h2 className="font-pacifico text-2xl text-primary-pink animate-pulse">Connecting Hearts...</h2>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center animate-in zoom-in">
                        <div className="w-20 h-20 bg-red-50 text-red-400 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <AlertCircle size={40} />
                        </div>
                        <h2 className="font-pacifico text-2xl text-slate-700 mb-2">Oops!</h2>
                        <p className="text-slate-500 font-quicksand mb-6">{error}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-slate-800 text-white font-semibold py-3 px-6 rounded-2xl shadow-soft hover:bg-slate-700 transition-all flex items-center gap-2"
                        >
                            <Home size={20} /> Go Home
                        </button>
                    </div>
                ) : success ? (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-4">
                        <div className="relative w-24 h-24 mb-4">
                            <div className="absolute inset-0 bg-primary-pink rounded-full animate-ping opacity-20"></div>
                            <div className="relative w-full h-full bg-pink-100 text-primary-pink rounded-full flex items-center justify-center shadow-soft">
                                <HeartHandshake size={48} />
                            </div>
                        </div>
                        <h2 className="font-pacifico text-3xl text-primary-pink mb-2">Partner Linked!</h2>
                        <p className="text-slate-500 font-quicksand mb-2">Your digital scrapbook is now shared.</p>
                        <p className="text-xs text-pink-400 font-bold uppercase tracking-widest mt-4">Redirecting...</p>
                    </div>
                ) : null}

            </div>
        </div>
    );
};
