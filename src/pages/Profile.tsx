import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import { Camera, LogOut, ArrowLeft, Heart, Edit2, Search, UserPlus, Unlink } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { InviteLinkManager } from '../components/InviteLinkManager';
import { toast } from 'sonner';

// Helper to extract image from cropper
const getCroppedImg = async (imageSrc: string, pixelCrop: any) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', (err) => reject(err));
        img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return null;
    }

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((file) => {
            if (file) resolve(file);
            else reject(new Error('Canvas is empty'));
        }, 'image/jpeg');
    });
};

export const Profile: React.FC = () => {
    const { user, signOut } = useAuth();

    const [profile, setProfile] = useState<any>(null);
    const [partner, setPartner] = useState<any>(null);

    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // View State
    const [viewingUser, setViewingUser] = useState<any>(null);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [profileLoading, setProfileLoading] = useState(false);

    // Cropper State
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { username: usernameParam } = useParams();

    // Search Partner State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (user) {
                await loadProfile();
                if (usernameParam) {
                    setSearchQuery(usernameParam);
                    loadPublicProfile(usernameParam);
                } else {
                    setViewingUser(null);
                    setPendingRequest(null);
                    setSearchResults([]);
                    setSearchQuery('');
                }
            }
        };
        init();
    }, [user, usernameParam]);

    // Auto-search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim() && !viewingUser) {
                handleSearch(searchQuery);
            } else if (!searchQuery.trim()) {
                setSearchResults([]);
            }
        }, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [searchQuery, viewingUser]);

    const loadProfile = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
            setName(data.name || '');
            setBio(data.bio || '');

            if (data.partner_id) {
                const { data: partnerData } = await supabase
                    .from('users')
                    .select('id, username, name, profile_photo_url')
                    .eq('id', data.partner_id)
                    .single();
                setPartner(partnerData);
            }

            // Also load incoming requests for the owner view
            const { data: requests } = await supabase
                .from('partner_requests')
                .select('*, sender:sender_id(id, username, name, profile_photo_url)')
                .eq('receiver_id', user.id)
                .eq('status', 'pending');

            // Deduplicate by sender_id just in case
            const uniqueRequests = requests ? Array.from(new Map(requests.map(item => [item.sender_id, item])).values()) : [];
            setIncomingRequests(uniqueRequests);

        } catch (err) {
            console.error("Error loading profile", err);
        } finally {
            setLoading(false);
        }
    };

    const loadPublicProfile = async (username: string) => {
        if (!user) return;
        try {
            setProfileLoading(true);
            setViewingUser(null);
            setPendingRequest(null);

            // Fetch target user
            const { data: targetUser, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (userError || !targetUser) {
                setViewingUser(null);
                setProfileLoading(false);
                return;
            }

            // Check if we are viewing ourselves
            if (targetUser.id === user.id) {
                setViewingUser(null);
                setProfileLoading(false);
                return;
            }

            console.log("DEBUG: Checking relationship between:", { me: user.id, target: targetUser.id });

            // Check for pending requests between us (Robust query handling multiple rows)
            const { data: requests, error: requestError } = await supabase
                .from('partner_requests')
                .select('*')
                .eq('status', 'pending')
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .or(`sender_id.eq.${targetUser.id},receiver_id.eq.${targetUser.id}`)
                .order('created_at', { ascending: false })
                .limit(1);

            if (requestError) console.error("DEBUG: Request lookup error:", requestError);

            const request = requests && requests.length > 0 ? requests[0] : null;
            console.log("DEBUG: Found pending request:", request);

            // Set both states at once to prevent flicker
            setViewingUser(targetUser);
            setPendingRequest(request);

        } catch (err) {
            console.error("Error loading public profile", err);
        } finally {
            setProfileLoading(false);
        }
    };

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            let imageDataUrl = await new Promise<string>((resolve) => {
                let reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            setImageSrc(imageDataUrl);
        }
    };

    const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleSavePhoto = async () => {
        if (!imageSrc || !croppedAreaPixels || !user) return;
        try {
            setSaving(true);
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (!croppedImageBlob) throw new Error("Could not crop image");

            // Convert Blob to File
            const file = new File([croppedImageBlob], "profile.jpg", { type: "image/jpeg" });

            const photoUrl = await uploadToCloudinary(file);

            await supabase
                .from('users')
                .update({ profile_photo_url: photoUrl })
                .eq('id', user.id);

            setProfile({ ...profile, profile_photo_url: photoUrl });
            setImageSrc(null); // Close cropper
            toast.success("Done");
        } catch (error) {
            console.error("Error saving photo:", error);
            toast.error("Failed to upload photo. Ensure Cloudinary settings are correct.");
        } finally {
            setSaving(false);
        }
    };

    const handleSearch = async (query: string = searchQuery) => {
        if (!query.trim() || !user) return;
        try {
            setSearching(true);
            const { data, error } = await supabase
                .from('users')
                .select('id, username, name, profile_photo_url')
                .ilike('username', `%${query}%`)
                .neq('id', user.id)
                .limit(5);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            toast.error("Search failed");
        } finally {
            setSearching(false);
        }
    };

    const sendPartnerRequest = async (receiverId: string) => {
        try {
            // Check if request already exists (incoming or outgoing)
            const { data: existing } = await supabase
                .from('partner_requests')
                .select('id')
                .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user?.id})`)
                .eq('status', 'pending')
                .maybeSingle();

            if (existing) {
                toast.error("A request is already pending!");
                return;
            }

            const { error: requestError } = await supabase
                .from('partner_requests')
                .insert({ sender_id: user?.id, receiver_id: receiverId } as any);

            if (requestError) throw requestError;

            // Create notification
            await supabase.from('notifications').insert({
                user_id: receiverId,
                type: 'request',
                related_user_id: user?.id
            } as any);

            toast.success("Request sent! 💌");
            // Automatically update state so it says "Request Already Sent" immediately
            setPendingRequest({
                sender_id: user?.id,
                receiver_id: receiverId,
                status: 'pending'
            });
            setSearchResults([]);
            setSearchQuery('');
        } catch (err) {
            toast.error("Could not send request. Maybe one is already pending?");
        }
    };

    const handleUnlink = async () => {
        toast.promise(async () => {
            const { error } = await supabase.rpc('unlink_partner' as any);
            if (error) throw error;
            setPartner(null);
            setProfile({ ...profile, partner_id: null });
        }, {
            loading: 'Unlinking...',
            success: 'Unlinked successfully. ☁️',
            error: 'Failed to unlink.'
        });
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        try {
            setSaving(true);
            await supabase
                .from('users')
                .update({ name, bio })
                .eq('id', user.id);

            setProfile({ ...profile, name, bio });
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating profile", error);
        } finally {
            setSaving(false);
        }
    };

    const handleAcceptRequest = async (requestId: string) => {
        console.log("DEBUG: Attempting to accept request ID:", requestId);
        toast.promise(async () => {
            const { error } = await (supabase.rpc as any)('accept_partner_request', { p_request_id: requestId });
            if (error) {
                console.error("DEBUG: Accept RPC Error:", error);
                throw error;
            }
            console.log("DEBUG: Accept RPC Success");
            loadProfile(); // Refresh personal profile
            setViewingUser(null);
            // Remove from query params
            setSearchQuery('');
        }, {
            loading: 'Accepting...',
            success: 'You are now partners! 💖',
            error: 'Failed to accept request.'
        });
    };

    const handleIgnoreRequest = async (requestId: string) => {
        try {
            const { error } = await supabase
                .from('partner_requests')
                .delete()
                .eq('id', requestId);
            if (error) throw error;
            setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
            setPendingRequest(null);
            toast.success("Request ignored ☁️");
        } catch (err) {
            toast.error("Action failed");
        }
    };

    const handleLogout = async () => {
        toast("Are you sure?", {
            action: {
                label: "Log Out",
                onClick: () => signOut()
            }
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary-pink border-t-soft-blush rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <Link
                    to="/"
                    onClick={() => { setViewingUser(null); setSearchQuery(''); }}
                    className="p-3 bg-white/60 hover:bg-white/90 rounded-2xl shadow-soft transition-all text-pink-400"
                >
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="font-pacifico text-3xl text-primary-pink">
                    {viewingUser ? "Profile View" : "My Profile"}
                </h1>
                {!viewingUser ? (
                    <button onClick={handleLogout} className="p-3 bg-white/60 hover:bg-red-50 rounded-2xl shadow-soft transition-all text-slate-400 hover:text-red-400">
                        <LogOut size={24} />
                    </button>
                ) : (
                    <div className="w-12" /> // Spacer
                )}
            </div>


            {/* Profile Photo Section */}
            <div className="flex flex-col items-center mb-6 relative z-10">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-soft bg-pink-50 flex items-center justify-center relative">
                        {(viewingUser?.profile_photo_url || profile?.profile_photo_url) ? (
                            <img
                                src={viewingUser?.profile_photo_url || profile?.profile_photo_url}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <Heart className="w-12 h-12 text-pink-200" fill="currentColor" />
                        )}
                    </div>
                    {!viewingUser && (
                        <>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 bg-primary-pink text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform z-20"
                            >
                                <Camera size={18} />
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={onFileChange}
                            />
                        </>
                    )}
                </div>
                <h2 className="font-pacifico text-3xl text-slate-700 mt-4 tracking-wide">
                    @{viewingUser?.username || profile?.username}
                </h2>
            </div>

            {/* Photo Cropper Modal */}
            {imageSrc && !viewingUser && (
                <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
                    <div className="relative w-full max-w-sm h-80 bg-white rounded-3xl overflow-hidden mb-4">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="round"
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                        />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setImageSrc(null)} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-2xl font-semibold">Cancel</button>
                        <button
                            onClick={handleSavePhoto}
                            disabled={saving}
                            className="px-6 py-2 bg-primary-pink text-white rounded-2xl font-semibold shadow-soft"
                        >
                            {saving ? "Saving..." : "Done"}
                        </button>
                    </div>
                </div>
            )}

            {/* Name & Bio Section */}
            <div className="bg-white/50 rounded-3xl p-6 relative border border-pink-100/50 shadow-inner">
                {!isEditing && !viewingUser && (
                    <button onClick={() => setIsEditing(true)} className="absolute top-4 right-4 text-slate-400 hover:text-primary-pink transition-colors">
                        <Edit2 size={20} />
                    </button>
                )}

                {isEditing && !viewingUser ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-slate-400 ml-2 uppercase tracking-widest font-black">Display Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full mt-1 bg-white border border-pink-100 rounded-2xl px-4 py-3 text-slate-700 outline-none focus:ring-4 focus:ring-primary-pink/10 transition-all font-medium"
                                placeholder="Your cute nickname..."
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 ml-2 uppercase tracking-widest font-black">Bio</label>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                className="w-full mt-1 bg-white border border-pink-100 rounded-2xl px-4 py-3 text-slate-700 outline-none focus:ring-4 focus:ring-primary-pink/10 transition-all h-24 resize-none"
                                placeholder="Write something sweet about yourself..."
                            />
                        </div>
                        <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="w-full bg-primary-pink text-white py-4 rounded-2xl shadow-soft font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                            {saving ? "Saving..." : "Done"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <h3 className="text-[10px] text-slate-400 ml-1 uppercase tracking-widest font-black flex items-center gap-2">
                                Display Name
                            </h3>
                            <p className="text-xl text-slate-800 font-bold ml-1">
                                {viewingUser ? (viewingUser.name || "Anonymous") : (profile?.name || "No name set")}
                            </p>
                        </div>
                        <div className="pt-2 border-t border-pink-50/50">
                            <h3 className="text-[10px] text-slate-400 ml-1 uppercase tracking-widest font-black flex items-center gap-2">
                                Bio
                            </h3>
                            <p className="text-slate-600 ml-1 font-medium leading-relaxed">
                                {viewingUser ? (viewingUser.bio || "This user prefers to stay mysterious... ☁️") : (profile?.bio || "Tell the world something cute! 🎀")}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Public View Interaction Buttons (Accept/Ignore or Request) */}
            {viewingUser && (
                <div className="mt-8 animate-in slide-in-from-top-4">
                    {/* UI Debug Info (Visible during troubleshooting) */}
                    <div className="hidden">
                        DEBUG: PR_ID: {pendingRequest?.id || 'none'}
                        SENDER: {pendingRequest?.sender_id}
                        ME: {user?.id}
                    </div>

                    {profileLoading ? (
                        <div className="w-full py-4 flex justify-center">
                            <div className="w-6 h-6 border-2 border-primary-pink border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : pendingRequest ? (
                        pendingRequest.receiver_id === user?.id ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleAcceptRequest(pendingRequest.id)}
                                    className="flex-1 bg-primary-pink text-white py-4 rounded-2xl font-bold shadow-soft flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
                                >
                                    <Heart size={20} fill="currentColor" /> Accept Request
                                </button>
                                <button
                                    onClick={() => handleIgnoreRequest(pendingRequest.id)}
                                    className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all font-heading"
                                >
                                    Later
                                </button>
                            </div>
                        ) : (
                            <div className="w-full bg-pink-50 text-primary-pink py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border border-pink-100 shadow-inner">
                                <Heart size={20} className="animate-pulse" /> Request Already Sent
                            </div>
                        )
                    ) : !viewingUser.partner_id && !profile?.partner_id ? (
                        <button
                            onClick={() => sendPartnerRequest(viewingUser.id)}
                            className="w-full bg-primary-pink text-white py-4 rounded-2xl font-bold shadow-soft flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
                        >
                            <UserPlus size={22} /> Send Partner Request
                        </button>
                    ) : (
                        <p className="text-center text-slate-400 italic text-sm py-2">
                            {viewingUser.partner_id ? "This user is already coupled up! 💖" : "You already have a partner"}
                        </p>
                    )}
                </div>
            )}

            {/* Partner Section (Owner Only) */}
            {!viewingUser && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-pacifico text-primary-pink ml-2 flex items-center gap-2">
                        My Partner <Heart size={20} fill="currentColor" />
                    </h2>
                    <div className="glass-card p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-pink/20 to-transparent"></div>

                        {partner ? (
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-soft">
                                        {partner.profile_photo_url ? (
                                            <img src={partner.profile_photo_url} alt="Partner" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-pink-50 flex items-center justify-center text-primary-pink/30">
                                                <Heart size={36} fill="currentColor" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-primary-pink text-white p-2 rounded-full shadow-lg">
                                        <Heart size={16} fill="currentColor" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold text-slate-700">{partner.name || `@${partner.username}`}</h3>
                                    <p className="text-primary-pink font-medium mt-1 select-none">
                                        Matched 💖
                                    </p>
                                </div>
                                <button
                                    onClick={handleUnlink}
                                    className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-xs font-bold pt-6 border-t border-pink-50 w-full justify-center uppercase tracking-widest"
                                >
                                    <Unlink size={14} /> Break Connection
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-pink-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner relative">
                                        <Heart className="text-pink-200" size={32} />
                                    </div>
                                    <p className="text-slate-500 font-medium">Looking for your soulmate? ☁️</p>
                                </div>

                                {/* Search Section */}
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            placeholder="Find their username..."
                                            className="w-full bg-white border border-pink-50 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-primary-pink/10 transition-all font-medium placeholder:text-slate-300"
                                        />
                                    </div>

                                    {searchResults.length > 0 && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2">
                                            {searchResults.map((res) => (
                                                <Link
                                                    to={`/profile/${res.username}`}
                                                    key={res.id}
                                                    className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-pink-50 shadow-sm hover:bg-white transition-all hover:translate-x-1"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 border-2 border-white">
                                                            {res.profile_photo_url ? (
                                                                <img src={res.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-200">
                                                                    <Heart size={16} fill="currentColor" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-md font-bold text-slate-700">{res.name || res.username}</p>
                                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">@{res.username}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-2 text-primary-pink opacity-40 hover:opacity-100 transition-opacity">
                                                        <Heart size={18} />
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}

                                    {searchQuery && searchResults.length === 0 && !searching && (
                                        <p className="text-center text-xs text-slate-400 font-medium">No users found nearby... 🐚</p>
                                    )}
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-pink-50"></div>
                                    <span className="relative bg-[#FFF5F6] px-4 text-[10px] uppercase tracking-widest text-slate-300 block w-fit mx-auto font-black">Invite Link</span>
                                </div>

                                <InviteLinkManager />
                            </div>
                        )}
                    </div>

                    {/* Pending Requests List */}
                    {!partner && incomingRequests.length > 0 && (
                        <div className="mt-8 space-y-4 animate-in slide-in-from-bottom-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Partner Requests</h3>
                            {incomingRequests.map((req) => (
                                <div key={req.id} className="flex items-center justify-between p-5 bg-white/90 backdrop-blur-sm rounded-[2rem] border border-pink-100 shadow-soft relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-2 opacity-5">
                                        <Heart size={40} fill="currentColor" className="text-primary-pink" />
                                    </div>
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-cute bg-pink-50 anime-border">
                                            {req.sender?.profile_photo_url ? (
                                                <img src={req.sender.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-primary-pink/30">
                                                    <Heart size={24} fill="currentColor" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-lg leading-tight">{req.sender?.name || `@${req.sender?.username}`}</p>
                                            <p className="text-primary-pink/60 text-xs font-bold uppercase tracking-widest mt-0.5">Wants to match! 🍬</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 relative z-10">
                                        <button
                                            onClick={() => handleAcceptRequest(req.id)}
                                            className="bg-primary-pink text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-soft hover:scale-105 transition-all"
                                        >
                                            YES!
                                        </button>
                                        <button
                                            onClick={() => handleIgnoreRequest(req.id)}
                                            className="bg-slate-100 text-slate-400 px-6 py-2.5 rounded-xl text-xs font-black hover:bg-slate-200 transition-all uppercase"
                                        >
                                            Later
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
