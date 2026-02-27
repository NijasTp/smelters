export interface GiphySticker {
    id: string;
    url: string; // The webp URL
    title: string;
}

export const searchStickers = async (query: string, limit = 20): Promise<GiphySticker[]> => {
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    if (!apiKey) {
        console.error("Giphy API key missing");
        return [];
    }

    try {
        const url = new URL('https://api.giphy.com/v1/stickers/search');
        url.searchParams.append('api_key', apiKey);
        url.searchParams.append('q', query);
        url.searchParams.append('limit', limit.toString());
        url.searchParams.append('rating', 'g');

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Giphy API error");

        const { data } = await response.json();

        return data.map((item: any) => ({
            id: item.id,
            url: item.images.fixed_height.url, // Using .url (gif) for better animation support in canvas
            title: item.title,
        }));
    } catch (error) {
        console.error("Failed to fetch stickers", error);
        return [];
    }
};

export const getTrendingStickers = async (limit = 20): Promise<GiphySticker[]> => {
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    if (!apiKey) return [];

    try {
        const url = new URL('https://api.giphy.com/v1/stickers/trending');
        url.searchParams.append('api_key', apiKey);
        url.searchParams.append('limit', limit.toString());
        url.searchParams.append('rating', 'g');

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Giphy API error");

        const { data } = await response.json();

        return data.map((item: any) => ({
            id: item.id,
            url: item.images.fixed_height.url,
            title: item.title,
        }));
    } catch (error) {
        console.error("Failed to fetch trending stickers", error);
        return [];
    }
};
