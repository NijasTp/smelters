import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Stage, Layer, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { ArrowLeft, Heart } from 'lucide-react';

const ReadOnlyImage = ({ element }: any) => {
    const [image] = useImage(element.src || '', 'anonymous');
    const shapeRef = useRef<any>(null);

    useEffect(() => {
        if (!image) return;
        let anim: any;
        const redraw = () => {
            if (shapeRef.current) shapeRef.current.getLayer()?.batchDraw();
            anim = requestAnimationFrame(redraw);
        };
        if (element.src?.includes('giphy') || element.src?.includes('.gif') || element.src?.includes('.webp')) {
            anim = requestAnimationFrame(redraw);
        }
        return () => {
            if (anim) cancelAnimationFrame(anim);
        };
    }, [image, element.src]);

    if (!image) return null;

    return (
        <KonvaImage
            image={image}
            ref={shapeRef}
            {...element}
        />
    );
};

export const DiaryViewer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [diary, setDiary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const stageRef = useRef<any>(null);

    useEffect(() => {
        if (!user || !id) return;
        loadDiary();
    }, [user, id]);

    const loadDiary = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('diaries')
                .select('*, sender:users!sender_id(name, username)')
                .eq('id', id!)
                .single();

            if (error) throw error;
            if (!data) throw new Error("Diary not found");

            setDiary(data);

            // If it's unread and the current user is the receiver, mark as read
            if (!data.is_read && data.receiver_id === user?.id) {
                await supabase
                    .from('diaries')
                    .update({ is_read: true })
                    .eq('id', id!);
            }

        } catch (err) {
            console.error(err);
            navigate('/');
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

    // Parse elements from JSON
    let elements = [];
    try {
        // The raw json might have a slightly different structure if saved via stage.toJSON()
        // stage.toJSON() exports a full tree (attrs, className, children)
        // To extract just our custom elements, we need to inspect it.
        const stageData = typeof diary.content_json === 'string' ? JSON.parse(diary.content_json) : diary.content_json;

        // Find the Layer children if it's a full export
        if (stageData.children && stageData.children.length > 0) {
            const layer = stageData.children[0];
            if (layer.children) {
                elements = layer.children.map((c: any) => c.attrs);
            }
        }
    } catch (e) {
        console.error("Failed to parse canvas", e);
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full max-w-full overflow-hidden bg-white/80 backdrop-blur-md relative sm:rounded-[2.5rem] sm:h-[85vh] sm:border-4 border-pink-50 shadow-cute animate-in fade-in zoom-in-95 duration-1000">
            {/* Paper Texture Background */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] z-0"></div>
            <div className="absolute inset-0 bg-[#fffdfa] z-[-1]"></div>

            {/* Header - Classy Letter Style */}
            <div className="bg-white/40 backdrop-blur-md p-6 flex items-center z-10 shrink-0 gap-6 border-b border-pink-50 relative">
                <Link to="/" className="p-3 bg-white hover:bg-pink-50 rounded-2xl transition-all shadow-sm text-primary-pink border border-pink-50">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-pink/40 mb-1">Incoming Letter</p>
                    <h1 className="text-3xl font-pacifico text-slate-800 leading-tight">
                        From {diary.sender?.name || `@${diary.sender?.username}`}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 bg-primary-pink rounded-full animate-pulse"></div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(diary.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Viewer Area - Scrapbook Base */}
            <div className="flex-1 relative overflow-hidden touch-none">
                {elements.length > 0 ? (
                    <Stage
                        width={window.innerWidth}
                        height={window.innerHeight - 150}
                        ref={stageRef}
                        className="absolute inset-0 z-10 pointer-events-none animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300"
                    >
                        <Layer>
                            {elements.map((el: any, i: number) => {
                                if (el.text) {
                                    return <Text key={i} {...el} wrap="word" />;
                                } else if (el.src || el.image) {
                                    return <ReadOnlyImage key={i} element={el} />;
                                }
                                return null;
                            })}
                        </Layer>
                    </Stage>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-10 text-center gap-4">
                        <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center text-pink-200 animate-soft-bounce">
                            <Heart size={40} fill="currentColor" />
                        </div>
                        <p className="text-slate-300 font-fredoka text-2xl">
                            This digital page is being decorated... 🎨
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
