import { useEffect, useState } from 'react';
import { Bell, Heart, UserPlus, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const NotificationBell = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showDrawer, setShowDrawer] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        fetchNotifications();

        // Real-time subscription
        const channel = supabase
            .channel('notifications_changes')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchNotifications = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('notifications')
            .select(`
                *,
                related_user:related_user_id (id, username, name, profile_photo_url)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read_status).length);
        }
    };

    const markAsRead = async () => {
        if (!user || unreadCount === 0) return;
        const { error } = await supabase
            .from('notifications')
            .update({ read_status: true })
            .eq('user_id', user.id);

        if (!error) setUnreadCount(0);
    };

    const toggleDrawer = () => {
        if (!showDrawer) markAsRead();
        setShowDrawer(!showDrawer);
    };

    return (
        <div className="relative">
            <button
                onClick={toggleDrawer}
                className="p-3 bg-white/80 rounded-2xl shadow-sm text-primary-pink hover:bg-white transition-all border border-pink-50 relative"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-400 text-white text-[10px] flex items-center justify-center rounded-full animate-pulse border-2 border-white">
                        {unreadCount}
                    </span>
                )}
            </button>

            {showDrawer && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/5 sm:bg-transparent" onClick={() => setShowDrawer(false)}></div>
                    <div className="absolute right-0 sm:right-0 mt-4 w-[calc(100vw-2rem)] sm:w-80 max-w-[320px] glass-card z-50 p-4 border-pink-100 animate-in slide-in-from-top-2 duration-300 overflow-hidden bg-white/95 shadow-2xl translate-x-[4.5rem] sm:translate-x-0">
                        <div className="flex justify-between items-center mb-4 border-b border-pink-50 pb-2 relative z-10">
                            <h3 className="text-lg font-heading text-primary-pink">Notifications</h3>
                            <button onClick={() => setShowDrawer(false)} className="text-slate-300 hover:text-primary-pink transition-colors"><X size={18} /></button>
                        </div>

                        <div className="max-h-96 overflow-y-auto space-y-3 pr-1 container-snap">
                            {notifications.length > 0 ? notifications.map((n) => (
                                <Link
                                    to={n.related_user?.username ? `/profile/${n.related_user.username}` : '#'}
                                    key={n.id}
                                    onClick={() => n.related_user?.username && setShowDrawer(false)}
                                    className="flex items-center gap-3 p-3 rounded-2xl bg-pink-50/30 hover:bg-pink-50 transition-colors border border-pink-50/50 block"
                                >
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-pink-100">
                                        {n.related_user?.profile_photo_url ? (
                                            <img src={n.related_user.profile_photo_url} alt="User" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-pink-200">
                                                <Heart size={20} fill="currentColor" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-700 leading-tight">
                                            <span className="font-bold">{n.related_user?.name || n.related_user?.username}</span>
                                            {n.type === 'request' && ' sent you a partner request!'}
                                            {n.type === 'accepted' && ' accepted your request!'}
                                            {n.type === 'removed' && ' unlinked from you.'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    {n.type === 'request' && <UserPlus size={16} className="text-primary-pink" />}
                                </Link>
                            )) : (
                                <p className="text-center text-slate-400 py-6 text-sm">No notifications yet ☁️</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
