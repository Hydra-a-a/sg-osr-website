import { redactErrorForLog } from '@/lib/security';
import type { ProcessNotificationQueueOptions } from '@/lib/notification-queue';

interface SafeProcessImmediateNotificationsInput {
    queueName: string;
    notificationIds: string[];
    processQueue: (options: ProcessNotificationQueueOptions) => Promise<unknown>;
    triggerFallback: () => void;
}

export async function safeProcessImmediateNotifications({
    queueName,
    notificationIds,
    processQueue,
    triggerFallback,
}: SafeProcessImmediateNotificationsInput): Promise<void> {
    try {
        if (notificationIds.length > 0) {
            await processQueue({
                limit: notificationIds.length,
                notificationIds,
            });
        }
    } catch (error) {
        console.warn(
            `[Notifications] Immediate ${queueName} processing failed; fallback queue will handle it.`,
            redactErrorForLog(error),
        );
    } finally {
        triggerFallback();
    }
}
