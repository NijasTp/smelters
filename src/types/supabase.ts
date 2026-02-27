export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    username: string
                    name: string | null
                    bio: string | null
                    profile_photo_url: string | null
                    partner_id: string | null
                    is_deleted: boolean
                    created_at: string
                }
                Insert: {
                    id: string
                    username: string
                    name?: string | null
                    bio?: string | null
                    profile_photo_url?: string | null
                    partner_id?: string | null
                    is_deleted?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    username?: string
                    name?: string | null
                    bio?: string | null
                    profile_photo_url?: string | null
                    partner_id?: string | null
                    is_deleted?: boolean
                    created_at?: string
                }
                Relationships: any[]
            }
            partner_requests: {
                Row: {
                    id: string
                    sender_id: string
                    receiver_id: string
                    status: 'pending' | 'accepted' | 'ignored'
                    created_at: string
                }
                Insert: {
                    id?: string
                    sender_id: string
                    receiver_id: string
                    status?: 'pending' | 'accepted' | 'ignored'
                    created_at?: string
                }
                Update: {
                    id?: string
                    sender_id?: string
                    receiver_id?: string
                    status?: 'pending' | 'accepted' | 'ignored'
                    created_at?: string
                }
                Relationships: any[]
            }
            notifications: {
                Row: {
                    id: string
                    user_id: string
                    type: 'request' | 'accepted' | 'removed'
                    related_user_id: string | null
                    read_status: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: 'request' | 'accepted' | 'removed'
                    related_user_id?: string | null
                    read_status?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: 'request' | 'accepted' | 'removed'
                    related_user_id?: string | null
                    read_status?: boolean
                    created_at?: string
                }
                Relationships: any[]
            }
            diaries: {
                Row: {
                    id: string
                    sender_id: string
                    receiver_id: string
                    content_json: Json
                    is_read: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    sender_id: string
                    receiver_id: string
                    content_json: Json
                    is_read?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    sender_id?: string
                    receiver_id?: string
                    content_json?: Json
                    is_read?: boolean
                    created_at?: string
                }
                Relationships: any[]
            }
            invite_links: {
                Row: {
                    id: string
                    creator_id: string
                    token: string
                    is_used: boolean
                    expires_at: string
                }
                Insert: {
                    id?: string
                    creator_id: string
                    token: string
                    is_used?: boolean
                    expires_at: string
                }
                Update: {
                    id?: string
                    creator_id?: string
                    token?: string
                    is_used?: boolean
                    expires_at?: string
                }
                Relationships: any[]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            accept_invite_link: {
                Args: { p_token: string }
                Returns: undefined
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
