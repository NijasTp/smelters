-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create tables
CREATE TABLE public.users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    name TEXT,
    bio TEXT,
    profile_photo_url TEXT,
    partner_id UUID REFERENCES public.users(id),
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.partner_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES public.users(id) NOT NULL,
    receiver_id UUID REFERENCES public.users(id) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'ignored')) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) NOT NULL,
    type TEXT CHECK (type IN ('request', 'accepted', 'removed')) NOT NULL,
    related_user_id UUID REFERENCES public.users(id),
    read_status BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.diaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES public.users(id) NOT NULL,
    receiver_id UUID REFERENCES public.users(id) NOT NULL,
    content_json JSONB NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.invite_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID REFERENCES public.users(id) NOT NULL,
    token TEXT UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT false NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- 3. Create Basic RLS Policies
-- Users: Anyone can view usernames/profiles, but only owner can update
CREATE POLICY "Profiles are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Partner Requests: Sender and receiver can view. Sender can insert. Receiver can update.
CREATE POLICY "Users can view partner requests they are involved in" ON public.partner_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create partner requests" ON public.partner_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receiver can update partner requests" ON public.partner_requests FOR UPDATE USING (auth.uid() = receiver_id);

-- Notifications: Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow notification creation" ON public.notifications FOR INSERT WITH CHECK (true);

-- Notifications: Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Diaries: Sender and Receiver can view. Sender can insert. Receiver can update (to mark as read).
CREATE POLICY "Users can view diaries they sent or received" ON public.diaries FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert diaries they send" ON public.diaries FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update diaries they received (mark as read)" ON public.diaries FOR UPDATE USING (auth.uid() = receiver_id);

-- Invite Links: Creators can view/insert.
CREATE POLICY "Users can view links they created" ON public.invite_links FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Users can insert links they create" ON public.invite_links FOR INSERT WITH CHECK (auth.uid() = creator_id);


-- 4. Create the accept_invite_link RPC Function
CREATE OR REPLACE FUNCTION public.accept_invite_link(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link_row record;
    v_receiver_id uuid;
BEGIN
    v_receiver_id := auth.uid();
    
    -- Check if authenticated
    IF v_receiver_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Find active token
    SELECT * INTO v_link_row
    FROM invite_links
    WHERE token = p_token AND is_used = false AND expires_at > now();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite link';
    END IF;
    
    -- Check if receiver already has a partner
    IF EXISTS (SELECT 1 FROM users WHERE id = v_receiver_id AND partner_id IS NOT NULL) THEN
        RAISE EXCEPTION 'You already have a partner';
    END IF;

    -- Check if creator already has a partner
    IF EXISTS (SELECT 1 FROM users WHERE id = v_link_row.creator_id AND partner_id IS NOT NULL) THEN
        RAISE EXCEPTION 'The creator of this link already has a partner';
    END IF;

    -- Update both users
    UPDATE users SET partner_id = v_link_row.creator_id WHERE id = v_receiver_id;
    UPDATE users SET partner_id = v_receiver_id WHERE id = v_link_row.creator_id;
    
    -- Mark link as used
    UPDATE invite_links SET is_used = true WHERE id = v_link_row.id;
    
    -- Create notification for the creator
    INSERT INTO notifications (user_id, type, related_user_id)
    VALUES (v_link_row.creator_id, 'accepted', v_receiver_id);
END;
$$;

-- 5. Create the unlink_partner RPC Function
CREATE OR REPLACE FUNCTION public.unlink_partner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_partner_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get partner ID
    SELECT partner_id INTO v_partner_id FROM users WHERE id = v_user_id;
    
    IF v_partner_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Update both users
    UPDATE users SET partner_id = NULL WHERE id = v_user_id;
    UPDATE users SET partner_id = NULL WHERE id = v_partner_id;
    
    -- Clear any lingering pending requests between them
    UPDATE partner_requests 
    SET status = 'ignored' 
    WHERE status = 'pending'
    AND (
        (sender_id = v_user_id AND receiver_id = v_partner_id) OR
        (sender_id = v_partner_id AND receiver_id = v_user_id)
    );
    
    -- Create notifications for both
    INSERT INTO notifications (user_id, type, related_user_id)
    VALUES (v_user_id, 'removed', v_partner_id);
    
    INSERT INTO notifications (user_id, type, related_user_id) 
    VALUES (v_partner_id, 'removed', v_user_id);
END;
$$;

-- 6. Create the accept_partner_request RPC Function
CREATE OR REPLACE FUNCTION public.accept_partner_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request record;
    v_receiver_id uuid;
BEGIN
    v_receiver_id := auth.uid();
    
    -- 1. Find the request and ensure I am the receiver
    SELECT * INTO v_request
    FROM partner_requests
    WHERE id = p_request_id AND receiver_id = v_receiver_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already handled';
    END IF;
    
    -- 2. Check if either already has a partner
    IF EXISTS (SELECT 1 FROM users WHERE id = v_receiver_id AND partner_id IS NOT NULL) THEN
        RAISE EXCEPTION 'You already have a partner';
    END IF;
    
    IF EXISTS (SELECT 1 FROM users WHERE id = v_request.sender_id AND partner_id IS NOT NULL) THEN
        RAISE EXCEPTION 'This user already has a partner';
    END IF;
    
    -- 3. Update both users
    UPDATE users SET partner_id = v_request.sender_id WHERE id = v_receiver_id;
    UPDATE users SET partner_id = v_receiver_id WHERE id = v_request.sender_id;
    
    -- 4. Mark THIS request as accepted
    UPDATE partner_requests SET status = 'accepted' WHERE id = v_request.id;

    -- 5. Clear all OTHER pending requests between these two users
    UPDATE partner_requests 
    SET status = 'ignored' 
    WHERE status = 'pending' 
    AND (
        (sender_id = v_request.sender_id AND receiver_id = v_receiver_id) OR
        (sender_id = v_receiver_id AND receiver_id = v_request.sender_id)
    );
    
    -- 6. Create notification for the sender
    INSERT INTO notifications (user_id, type, related_user_id)
    VALUES (v_request.sender_id, 'accepted', v_receiver_id);
END;
$$;
