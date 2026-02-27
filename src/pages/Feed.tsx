import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Heart, Plus, User } from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';

export const Feed: React.FC = () => {
    const { user } = useAuth();
    const [unreadDiaries, setUnreadDiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadDiaries();
        }
    }, [user]);

    const loadDiaries = async () => {
        try {
            setLoading(true);
            const { data: unreadData } = await supabase
                .from('diaries')
                .select('id, created_at, sender:users!sender_id(name, username, profile_photo_url)')
                .eq('receiver_id', user!.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false });

            if (unreadData) setUnreadDiaries(unreadData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary-pink border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-700 pb-24 max-w-2xl mx-auto w-full">

            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-10 mt-2 relative">
                <div>
                    <h1 className="text-4xl text-primary-pink drop-shadow-sm font-pacifico relative z-10">
                        Smelters
                    </h1>
                    <p className="text-sm text-slate-400 font-medium tracking-tight mt-1 flex items-center gap-2">
                        Capture your love stories 💌
                    </p>
                </div>
                <div className="flex gap-3">
                    <NotificationBell />
                    <Link to="/profile" className="p-3 bg-white/80 rounded-2xl shadow-sm text-primary-pink hover:bg-white transition-all border border-pink-50 relative group">
                        <User size={24} />
                    </Link>
                </div>
            </div>

            {/* Unread Diaries Section */}
            <div className="mb-12">
                {unreadDiaries.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {unreadDiaries.map((diary, idx) => (
                            <Link
                                key={diary.id}
                                to={`/diary/${diary.id}`}
                                className="group relative"
                            >
                                <div className={`
                                    bg-[#fffdfa] p-8 rounded-lg shadow-xl border-t-[1rem] border-primary-pink/20
                                    transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl
                                    relative overflow-hidden flex flex-col items-center gap-4 text-center
                                    ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}
                                    hover:rotate-0
                                `}>
                                    {/* Wax Seal Effect */}
                                    <div className="absolute top-4 right-4 w-12 h-12 bg-primary-pink rounded-full shadow-lg flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform cursor-pointer z-10">
                                        <Heart size={20} fill="currentColor" />
                                    </div>

                                    {/* Paper Texture Overlay */}
                                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>

                                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-soft relative z-10 transition-transform group-hover:scale-110">
                                        {diary.sender?.profile_photo_url ? (
                                            <img src={diary.sender.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-pink-50 flex items-center justify-center text-primary-pink">
                                                <Heart size={32} fill="currentColor" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative z-10">
                                        <p className="text-xs font-black uppercase tracking-widest text-primary-pink/40 mb-1">Incoming Letter From</p>
                                        <p className="text-2xl font-pacifico text-slate-800">
                                            {diary.sender?.name || `@${diary.sender?.username}`}
                                        </p>
                                    </div>

                                    <div className="w-full h-px bg-slate-100 my-2 relative z-10"></div>

                                    <div className="flex items-center gap-2 text-primary-pink font-bold text-sm bg-pink-50/50 px-4 py-2 rounded-full relative z-10">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-pink opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-pink"></span>
                                        </span>
                                        OPEN LETTER
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white/30 border-2 border-dashed border-primary-pink/20 rounded-[2.5rem] p-16 text-center">
                        <p className="text-slate-400 font-medium italic text-xl">Waiting for new notes... 🍬</p>
                    </div>
                )}
            </div>

            {/* Floating Action Button */}
            <Link
                to="/diary/new"
                className="fixed bottom-10 right-10 w-16 h-16 bg-primary-pink rounded-3xl shadow-cute flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-300 z-50 group rotate-[10deg] hover:rotate-0"
            >
                <Plus size={36} />
            </Link>
        </div>
    );
};
