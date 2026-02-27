import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Link2, Copy, Check } from 'lucide-react';

export const InviteLinkManager: React.FC = () => {
    const { user } = useAuth();
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateInviteLink = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            // Create a secure 32 char token
            const array = new Uint8Array(16);
            window.crypto.getRandomValues(array);
            const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

            // Expires in 7 days
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const { error: dbError } = await supabase
                .from('invite_links')
                .insert({
                    creator_id: user.id,
                    token,
                    expires_at: expiresAt.toISOString()
                })
                .select()
                .single();

            if (dbError) throw dbError;

            const fullLink = `${window.location.origin}/invite/${token}`;
            setInviteLink(fullLink);
        } catch (err: any) {
            console.error("Error generating link", err);
            setError("Failed to generate link.");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="mt-4">
            {!inviteLink ? (
                <button
                    onClick={generateInviteLink}
                    disabled={loading}
                    className="w-full bg-white/80 border-2 dashed border-pink-200 text-pink-500 font-semibold py-3 px-6 rounded-2xl shadow-sm hover:shadow-soft transition-all flex justify-center items-center gap-2"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-primary-pink/30 border-t-primary-pink rounded-full animate-spin"></div>
                    ) : (
                        <><Link2 size={20} /> Generate Invite Link</>
                    )}
                </button>
            ) : (
                <div className="bg-pink-50 p-4 rounded-2xl border border-pink-200 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-2">Your Secret Link</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={inviteLink}
                            className="flex-1 bg-white px-3 py-2 rounded-xl text-slate-600 outline-none text-sm"
                        />
                        <button
                            onClick={copyToClipboard}
                            className="bg-primary-pink text-white p-2 rounded-xl shadow-soft hover:bg-pink-400 transition-colors"
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">Send this link to your partner. Valid for 7 days.</p>
                </div>
            )}
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
};
