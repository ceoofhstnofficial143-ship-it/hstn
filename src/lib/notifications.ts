import { supabase } from "./supabase"

/**
 * 📧 HSTNLX NOTIFICATION PROTOCOL
 * Universal dispatcher for all user-facing transmissions.
 * Currently: Mocked (Logging only).
 * Next Phase: Integration with Resend/SendGrid.
 */

interface NotificationPayload {
    userId: string
    type: 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'payout_settled' | 'order_disputed' | 'dispute_resolved'
    data: any
}

export const NotificationProtocol = {
    async send(payload: NotificationPayload) {
        console.log(`[NOTIFICATION PROTOCOL INITIALIZED] Destination: ${payload.userId}`);
        console.log(`[PROTOCOL TYPE] ${payload.type.toUpperCase()}`);
        console.log(`[METADATA]`, payload.data);

        // 📝 Record in database for "In-App" notifications
        try {
            const { error } = await (supabase as any)
                .from("notifications")
                .insert({
                    user_id: payload.userId,
                    type: payload.type,
                    message: this.generateMessage(payload),
                    payload: payload.data
                });

            if (error) console.error("Notification logging failed:", error.message);
        } catch (err) {
            console.error("Critical notification record failure:", err);
        }

        // 📧 5. INSTITUTIONAL EMAIL RELAY
        if (process.env.RESEND_API_KEY) {
             const message = this.generateMessage(payload);
             // In production, we'd fetch the recipient email from the profiles table here
             // or pass it in the payload. For this protocol:
             console.log(`[PROTOCOL] Ready for email relay: ${message}`);
        }
    },

    /**
     * 📧 INSTITUTIONAL EMAIL RELAY (Resend Internal)
     */
    async sendDiscordianEmail(to: string, subject: string, content: string) {
        if (!process.env.RESEND_API_KEY) {
            console.warn("[NOTIFICATIONS] Resend API Key missing. Skipping email relay.");
            return;
        }

        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
                },
                body: JSON.stringify({
                    from: 'HSTNLX Authority <authority@hstnlx.com>',
                    to: [to],
                    subject: subject,
                    html: `
                        <div style="font-family: sans-serif; background: #000; color: #fff; padding: 40px; border-radius: 20px;">
                            <h1 style="font-style: italic; text-transform: uppercase; letter-spacing: -2px;">${subject}</h1>
                            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; margin-top: 20px;">
                                ${content}
                            </div>
                            <p style="font-size: 10px; text-transform: uppercase; opacity: 0.5; margin-top: 40px; letter-spacing: 2px;">
                                This is an institutional communication from HSTNLX Network.
                            </p>
                        </div>
                    `
                })
            });
            console.log(`[NOTIFICATIONS] Email protocol dispatched to ${to}`);
        } catch (err) {
            console.error("[NOTIFICATIONS] Email relay failed:", err);
        }
    },

    generateMessage(payload: NotificationPayload) {
        const messages: Record<string, string> = {
            'order_confirmed': `Acquisition confirmed for order #${payload.data.orderId?.slice(0, 8)}. Portfolio updated.`,
            'order_shipped': `Your luxury asset for order #${payload.data.orderId?.slice(0, 8)} is now in transit.`,
            'order_delivered': `Final delivery confirmed for order #${payload.data.orderId?.slice(0, 8)}. Review asset quality now.`,
            'payout_settled': `Institutional settlement processed for Merchant #${payload.userId?.slice(0, 8)}.`,
            'order_disputed': `Conflict protocol initialized for order #${payload.data.orderId?.slice(0, 8)}. Escrow locked.`,
            'dispute_resolved': `Institutional audit concluded for order #${payload.data.orderId?.slice(0, 8)}. State synchronized.`
        }
        return messages[payload.type] || "New transaction update recorded.";
    }
}
