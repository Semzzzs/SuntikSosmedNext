import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useNotifications(user) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const checkNotifs = useCallback(async () => {
        // ✅ Fix: ambil email dari session Supabase, bukan prop user yang dari sessionStorage
        const { data: { session } } = await supabase.auth.getSession();
        const authEmail = session?.user?.email;
        if (!authEmail) return;

        const { data: tickets } = await supabase
            .from('tickets')
            .select('id, subject, replies, updated_at')
            .eq('email', authEmail)
            .order('updated_at', { ascending: false });

        if (!tickets) return;

        // Status read disimpan di localStorage — hanya UI state, bukan data penting
        const readAt = JSON.parse(localStorage.getItem(`notif_read_${authEmail}`) || '{}');

        const newNotifs = [];
        for (const ticket of tickets) {
            const adminReplies = (ticket.replies || []).filter(r => r.from === 'admin');
            for (const reply of adminReplies) {
                const notifId = `${ticket.id}_${reply.at}`;
                if (!readAt[notifId]) {
                    newNotifs.push({
                        id: notifId,
                        ticketId: ticket.id,
                        ticketSubject: ticket.subject,
                        message: reply.message,
                        at: reply.at,
                        read: false,
                    });
                }
            }
        }

        newNotifs.sort((a, b) => new Date(b.at) - new Date(a.at));
        setNotifications(newNotifs);
        setUnreadCount(newNotifs.length);
    }, [user?.email]);

    useEffect(() => {
        checkNotifs();
        const interval = setInterval(checkNotifs, 15000); // 15 detik (tidak perlu terlalu sering)
        return () => clearInterval(interval);
    }, [checkNotifs]);

    const markAllRead = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const authEmail = session?.user?.email;
        if (!authEmail) return;
        const readAt = JSON.parse(localStorage.getItem(`notif_read_${authEmail}`) || '{}');
        for (const n of notifications) readAt[n.id] = true;
        localStorage.setItem(`notif_read_${authEmail}`, JSON.stringify(readAt));
        setNotifications([]);
        setUnreadCount(0);
    }, [notifications]);

    const markRead = useCallback(async (notifId) => {
        const { data: { session } } = await supabase.auth.getSession();
        const authEmail = session?.user?.email;
        if (!authEmail) return;
        const readAt = JSON.parse(localStorage.getItem(`notif_read_${authEmail}`) || '{}');
        readAt[notifId] = true;
        localStorage.setItem(`notif_read_${authEmail}`, JSON.stringify(readAt));
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    return { notifications, unreadCount, markAllRead, markRead, checkNotifs };
}