import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Text, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { v4 as uuidv4 } from 'uuid';
import { searchStickers, getTrendingStickers, type GiphySticker } from '../services/giphy';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Heart, Search, Type, Palette, Save, ArrowLeft, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

// Types for our Canvas Elements
export type CanvasElementType = 'text' | 'image';

export interface CanvasElement {
    id: string;
    type: CanvasElementType;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;

    // Text specific
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fill?: string;
    padding?: number;
    align?: string;

    // Image specific
    src?: string;
    width?: number;
    height?: number;
}

// Custom Konva Image Component to handle use-image hook
const URLImage = ({ element, isSelected, onSelect, onChange }: any) => {
    const [image] = useImage(element.src || '', 'anonymous');
    const shapeRef = useRef<any>(null);
    const trRef = useRef<any>(null);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    // GIF Animation Loop
    useEffect(() => {
        if (!image) return;

        // If it's a GIF/WebP (animated), we need to redraw the layer constantly while it's visible
        let anim: any;
        const redraw = () => {
            if (shapeRef.current) {
                shapeRef.current.getLayer().batchDraw();
            }
            anim = requestAnimationFrame(redraw);
        };

        if (element.src.includes('giphy') || element.src.includes('.gif') || element.src.includes('.webp')) {
            anim = requestAnimationFrame(redraw);
        }

        return () => {
            if (anim) cancelAnimationFrame(anim);
        };
    }, [image, element.src]);

    if (!image) return null; // Wait for image to load

    return (
        <React.Fragment>
            <KonvaImage
                image={image}
                onClick={onSelect}
                onTap={onSelect}
                ref={shapeRef}
                {...element}
                draggable
                onDragEnd={(e) => {
                    onChange({
                        ...element,
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={() => {
                    const node = shapeRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    // Reset scale, but update width/height for Konva Image
                    node.scaleX(1);
                    node.scaleY(1);
                    onChange({
                        ...element,
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 10 || newBox.height < 10) return oldBox;
                        return newBox;
                    }}
                />
            )}
        </React.Fragment>
    );
};

// Custom Text Component
const EditableText = ({ element, isSelected, onSelect, onChange, onEdit }: any) => {
    const shapeRef = useRef<any>(null);
    const trRef = useRef<any>(null);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    useEffect(() => {
        if (shapeRef.current) {
            shapeRef.current.getLayer().batchDraw();
        }
    }, [element.width, element.text]);

    return (
        <React.Fragment>
            <Text
                onClick={onSelect}
                onTap={onSelect}
                onDblClick={(e) => onEdit(element, (e.evt as any).clientX, (e.evt as any).clientY)}
                onDblTap={(e) => {
                    const evt = e.evt as any;
                    const clientX = evt.touches?.[0]?.clientX || evt.clientX || 0;
                    const clientY = evt.touches?.[0]?.clientY || evt.clientY || 0;
                    onEdit(element, clientX, clientY);
                }}
                ref={shapeRef}
                {...element}
                wrap="word"
                draggable
                onDragEnd={(e) => {
                    onChange({
                        ...element,
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={() => {
                    const node = shapeRef.current;
                    const scaleX = node.scaleX();
                    // For text, we prefer updating WIDTH to keep font size consistent if possible, 
                    // but Transformer usually scales scaleX.
                    // We'll update width and reset scaleX/Y.
                    const newWidth = Math.max(20, node.width() * scaleX);
                    node.scaleX(1);
                    node.scaleY(1);

                    onChange({
                        ...element,
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        width: newWidth,
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    enabledAnchors={['middle-left', 'middle-right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 50) return oldBox;
                        return newBox;
                    }}
                />
            )}
        </React.Fragment>
    );
};

export const DiaryEditor: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const stageRef = useRef<any>(null);

    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedId, selectShape] = useState<string | null>(null);

    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Tools state
    const [showStickers, setShowStickers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [stickers, setStickers] = useState<GiphySticker[]>([]);
    const [searching, setSearching] = useState(false);

    // Text Edit State
    const [editingText, setEditingText] = useState<{ id: string; val: string } | null>(null);
    const [showStyleModal, setShowStyleModal] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<any>(null);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            handleTrendingGiphy();
            return;
        }

        if (debounceTimer) clearTimeout(debounceTimer);

        const timer = setTimeout(() => {
            handleSearchGiphy();
        }, 500);

        setDebounceTimer(timer);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch partner on load
    useEffect(() => {
        async function loadPartner() {
            if (!user) return;
            const { data } = await supabase.from('users').select('partner_id').eq('id', user!.id).single();
            if (data?.partner_id) setPartnerId(data.partner_id);
        }
        loadPartner();
    }, [user]);

    // Deselect on bg click
    const checkDeselect = (e: any) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) selectShape(null);
    };

    // Fetch trending/search
    useEffect(() => {
        if (showStickers && stickers.length === 0) {
            handleTrendingGiphy();
        }
    }, [showStickers]);

    const handleTrendingGiphy = async () => {
        setSearching(true);
        const results = await getTrendingStickers();
        setStickers(results);
        setSearching(false);
    };

    const handleSearchGiphy = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setSearching(true);
        const results = await searchStickers(searchQuery);
        setStickers(results);
        setSearching(false);
    };

    const addStickerToCanvas = (url: string) => {
        const newEl: CanvasElement = {
            id: uuidv4(),
            type: 'image',
            src: url,
            x: 50,
            y: 50,
            width: 150,
            height: 150,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
        };
        setElements([...elements, newEl]);
        setShowStickers(false);
        selectShape(newEl.id);
    };

    const addText = () => {
        const newEl: CanvasElement = {
            id: uuidv4(),
            type: 'text',
            text: 'Double click to edit',
            x: 50,
            y: 50,
            width: 250, // Initial width for wrap
            fontSize: 28,
            fontFamily: 'Fredoka',
            fill: '#FF9AA2',
            padding: 10,
            align: 'center',
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
        };
        setElements([...elements, newEl]);
        selectShape(newEl.id);
    };

    const deleteSelected = () => {
        if (selectedId) {
            setElements(elements.filter(el => el.id !== selectedId));
            selectShape(null);
        }
    };

    const saveDiary = async () => {
        if (!user || !partnerId) {
            toast.error("You need a partner to share memories! ☁️");
            return;
        }

        // Deselect before saving so transformer handles don't show up in JSON (though we only save elements array here, so it's fine)
        selectShape(null);

        // Tiny delay to ensure React state caught up
        setTimeout(async () => {
            setSaving(true);
            try {
                const stageJSON = stageRef.current.toJSON();

                const { error } = await supabase.from('diaries').insert({
                    sender_id: user.id,
                    receiver_id: partnerId!,
                    content_json: JSON.parse(stageJSON),
                    is_read: false
                });

                if (error) throw error;
                toast.success("Memory shared with your partner! 💌");
                navigate('/');
            } catch (err: any) {
                toast.error(err.message || "Failed to save diary.");
            } finally {
                setSaving(false);
            }
        }, 100);
    };

    return (
        <div className="flex flex-col h-[100dvh] w-full max-w-full overflow-hidden bg-white relative -m-6 sm:m-0 sm:rounded-[2.5rem] sm:h-[85vh] sm:border-4 border-pink-50 shadow-cute animate-in zoom-in-95 duration-700">

            {/* Top Bar - Clean Style */}
            <div className="bg-white/60 backdrop-blur-sm p-4 flex justify-between items-center z-10 shrink-0 border-b border-pink-50">
                <Link to="/" className="p-2 text-primary-pink hover:bg-pink-50 rounded-2xl transition-all shadow-sm">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-3xl font-fredoka text-slate-800">New Memory</h1>
                <button
                    onClick={saveDiary}
                    disabled={saving || !partnerId}
                    className="cute-button text-2xl disabled:opacity-50"
                >
                    {saving ? "Sending..." : <><Save size={20} /> Share</>}
                </button>
            </div>

            {!partnerId && (
                <div className="bg-romantic-gold/10 text-romantic-gold p-3 text-center text-sm font-bold font-fredoka border-b border-romantic-gold/10">
                    ✨ You need a partner to share this memory! Link from your profile first.
                </div>
            )}

            {/* Editor Area - Clean White */}
            <div className="flex-1 relative overflow-hidden touch-none bg-white">
                <Stage
                    width={window.innerWidth > 768 ? 768 : window.innerWidth}
                    height={window.innerHeight - 200}
                    onMouseDown={checkDeselect}
                    onTouchStart={checkDeselect}
                    ref={stageRef}
                    className="absolute inset-0 z-10"
                >
                    <Layer>
                        {elements.map((el, i) => {
                            if (el.type === 'text') {
                                return (
                                    <EditableText
                                        key={el.id}
                                        element={el}
                                        isSelected={el.id === selectedId}
                                        onSelect={() => {
                                            if (editingText) return;
                                            selectShape(el.id);
                                        }}
                                        onChange={(newAttrs: any) => {
                                            const rects = elements.slice();
                                            rects[i] = newAttrs;
                                            setElements(rects);
                                        }}
                                        onEdit={(elData: any, _cx: number, _cy: number) => {
                                            setEditingText({ id: el.id, val: elData.text || '' });
                                        }}
                                    />
                                );
                            } else if (el.type === 'image') {
                                return (
                                    <URLImage
                                        key={el.id}
                                        element={el}
                                        isSelected={el.id === selectedId}
                                        onSelect={() => selectShape(el.id)}
                                        onChange={(newAttrs: any) => {
                                            const rects = elements.slice();
                                            rects[i] = newAttrs;
                                            setElements(rects);
                                        }}
                                    />
                                );
                            }
                            return null;
                        })}
                    </Layer>
                </Stage>

                {/* Text Edit Modal - Sticker Style */}
                {editingText && (
                    <div className="absolute inset-0 bg-primary-pink/10 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <div className="paper-card p-8 w-full max-w-sm rotate-1 animate-in zoom-in-95">
                            <h3 className="font-handwriting text-3xl text-primary-pink mb-4">Write your heart out...</h3>
                            <textarea
                                value={editingText.val}
                                onChange={e => setEditingText({ ...editingText, val: e.target.value })}
                                className="w-full text-2xl font-handwriting border-none bg-transparent outline-none resize-none h-48 leading-relaxed text-slate-700"
                                autoFocus
                                placeholder="Once upon a time..."
                            />
                            <button
                                onClick={() => {
                                    setElements(elements.map(el => el.id === editingText.id ? { ...el, text: editingText.val } : el));
                                    setEditingText(null);
                                }}
                                className="w-full bg-primary-pink text-white py-4 rounded-2xl font-bold font-handwriting text-3xl mt-6 shadow-float transition-all active:scale-95"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Style Modal - Palette Style */}
            {showStyleModal && selectedId && elements.find(e => e.id === selectedId)?.type === 'text' && (
                <div className="absolute inset-0 bg-white/20 backdrop-blur-md z-50 flex items-end justify-center sm:items-center p-4">
                    <div className="bg-white/90 backdrop-blur-xl border-4 border-pink-50 rounded-[2.5rem] p-8 w-full max-w-sm shadow-cute animate-in slide-in-from-bottom sm:zoom-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-fredoka text-2xl text-slate-800">Style Palette</h3>
                            <button onClick={() => setShowStyleModal(false)} className="p-2 hover:bg-pink-50 rounded-full text-slate-400">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Cute Fonts</p>
                                <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2 container-snap">
                                    {['Fredoka', 'Quicksand', 'Pacifico', 'Inter', 'Caveat', 'Comfortaa', 'Indie Flower', 'Shadows Into Light'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setElements(elements.map(e => e.id === selectedId ? { ...e, fontFamily: f } : e))}
                                            className={`py-3 rounded-2xl border-2 transition-all text-sm ${elements.find(e => e.id === selectedId)?.fontFamily === f ? 'border-primary-pink bg-pink-50 text-primary-pink' : 'border-pink-50 bg-white text-slate-600 hover:border-pink-200'}`}
                                            style={{ fontFamily: f }}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Pastel Colors</p>
                                <div className="flex flex-wrap gap-3 max-h-24 overflow-y-auto pr-2 container-snap">
                                    {['#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#FDFD96', '#84B6F4', '#77DD77', '#FDBCB4', '#4A4A4A'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setElements(elements.map(e => e.id === selectedId ? { ...e, fill: c } : e))}
                                            className="w-10 h-10 rounded-full border-4 border-white shadow-sm transition-transform active:scale-90"
                                            style={{ backgroundColor: c, boxShadow: elements.find(e => e.id === selectedId)?.fill === c ? '0 0 0 2px #FF9AA2' : 'none' }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowStyleModal(false)}
                            className="w-full mt-8 bg-primary-pink text-white py-4 rounded-2xl font-bold font-fredoka shadow-soft active:scale-95 transition-all text-xl"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Toolbar - Layered Paper Style */}
            <div className="bg-white/60 backdrop-blur-xl p-6 flex justify-around items-center z-10 shrink-0 border-t border-primary-pink/10 pb-12 sm:pb-8">
                <button onClick={addText} className="flex flex-col items-center gap-2 group">
                    <div className="p-4 bg-antique-cream rounded-2xl shadow-paper group-hover:scale-110 transition-transform text-slate-600">
                        <Type size={28} />
                    </div>
                    <span className="font-cursive text-xl text-slate-500">Text</span>
                </button>

                <button onClick={() => setShowStickers(true)} className="flex flex-col items-center gap-2 group">
                    <div className="p-4 bg-antique-cream rounded-2xl shadow-paper group-hover:scale-110 transition-transform text-pink-400">
                        <Heart size={28} fill="currentColor" />
                    </div>
                    <span className="font-cursive text-xl text-slate-500">Sticker</span>
                </button>

                {selectedId && elements.find(e => e.id === selectedId)?.type === 'text' && (
                    <button
                        onClick={() => setShowStyleModal(true)}
                        className="flex flex-col items-center gap-2 group animate-in slide-in-from-bottom-2"
                    >
                        <div className="p-4 bg-antique-cream rounded-2xl shadow-paper group-hover:scale-110 transition-transform text-romantic-gold">
                            <Palette size={28} />
                        </div>
                        <span className="font-cursive text-xl text-slate-500">Style</span>
                    </button>
                )}

                <button
                    onClick={deleteSelected}
                    disabled={!selectedId}
                    className={`flex flex-col items-center gap-2 transition-all ${selectedId ? 'group hover:scale-105' : 'opacity-30'}`}
                >
                    <div className="p-4 bg-antique-cream rounded-2xl shadow-paper text-slate-400 group-hover:text-red-400 transition-colors">
                        <Trash2 size={28} />
                    </div>
                    <span className="font-cursive text-xl text-slate-500">Dustbin</span>
                </button>
            </div>

            {/* Giphy Sticker Drawer - Scrapbook Style */}
            {showStickers && (
                <div className="absolute inset-0 bg-primary-pink/5 backdrop-blur-md z-50 flex flex-col animate-in slide-in-from-bottom-full duration-500">
                    <div className="p-8 pb-4 flex justify-between items-center">
                        <h3 className="font-display text-4xl text-primary-pink">Stickers</h3>
                        <button onClick={() => setShowStickers(false)} className="p-3 bg-white hover:bg-slate-50 rounded-full text-slate-400 shadow-paper transition-all active:scale-95">
                            <X size={28} />
                        </button>
                    </div>

                    <div className="p-8 pt-0 flex-1 flex flex-col overflow-hidden">
                        <form onSubmit={handleSearchGiphy} className="flex gap-3 mb-8">
                            <div className="flex-1 relative">
                                <Search size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-primary-pink/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Find sparkly things..."
                                    className="w-full bg-white/80 rounded-[2rem] py-5 pl-14 pr-6 outline-none shadow-paper focus:ring-4 focus:ring-primary-pink/10 text-xl font-handwriting text-slate-700"
                                />
                            </div>
                            <button type="submit" disabled={searching} className="bg-primary-pink text-white px-8 rounded-[2rem] shadow-float font-bold font-handwriting text-2xl active:scale-95 transition-all">
                                Go!
                            </button>
                        </form>

                        <div className="flex-1 overflow-y-auto min-h-0 container-snap px-2">
                            {searching && stickers.length === 0 ? (
                                <div className="flex flex-col justify-center items-center h-full gap-4">
                                    <div className="w-12 h-12 border-4 border-primary-pink/20 border-t-primary-pink rounded-full animate-spin"></div>
                                    <p className="font-handwriting text-2xl text-primary-pink/60">Searching for magic...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pb-12">
                                    {stickers.map((s, idx) => (
                                        <button
                                            key={s.id + idx}
                                            onClick={() => addStickerToCanvas(s.url)}
                                            className="paper-card p-4 h-40 flex items-center justify-center hover:scale-105 transition-all active:scale-95 rotate-1 group"
                                            style={{ transform: `rotate(${(idx % 3 - 1) * 2}deg)` }}
                                        >
                                            <img src={s.url} alt={s.title} className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-sm group-hover:drop-shadow-md" />
                                        </button>
                                    ))}
                                    {stickers.length === 0 && searchQuery && !searching && (
                                        <div className="col-span-full text-center py-20">
                                            <p className="font-handwriting text-3xl text-slate-300">No magic found 😢</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
