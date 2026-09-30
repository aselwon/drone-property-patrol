import { Incident, IncidentSeverity } from '@patrol/shared';

export interface NotificationItem {
  id: string;
  timestamp: number;
  title: string;
  message: string;
  severity: IncidentSeverity;
  incidentId?: string;
  channel: 'IN_APP' | 'WEBHOOK' | 'SMS_SIMULATED' | 'EMAIL_SIMULATED';
  read: boolean;
}

export class NotificationService {
  private notifications: NotificationItem[] = [];
  private webhookUrls: string[] = [];
  private listeners: Set<(item: NotificationItem) => void> = new Set();

  public getNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  public registerWebhook(url: string): void {
    if (!this.webhookUrls.includes(url)) {
      this.webhookUrls.push(url);
    }
  }

  public onNotification(listener: (item: NotificationItem) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public markAsRead(id: string): void {
    const item = this.notifications.find((n) => n.id === id);
    if (item) item.read = true;
  }

  public markAllAsRead(): void {
    for (const item of this.notifications) {
      item.read = true;
    }
  }

  public notifyIncident(incident: Incident): NotificationItem {
    const item: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      title: `[${incident.severity}] ${incident.title}`,
      message: `${incident.description} (Confidence: ${Math.round(incident.confidence * 100)}%)`,
      severity: incident.severity,
      incidentId: incident.id,
      channel: 'IN_APP',
      read: false,
    };

    this.notifications.unshift(item);
    if (this.notifications.length > 100) {
      this.notifications.pop();
    }

    for (const listener of this.listeners) {
      try {
        listener(item);
      } catch (err) {
        console.error('Error delivering notification listener:', err);
      }
    }

    // Trigger external webhooks if registered
    if (this.webhookUrls.length > 0 && (incident.severity === 'HIGH' || incident.severity === 'MEDIUM')) {
      for (const url of this.webhookUrls) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'incident.alert', incident, notification: item }),
        }).catch((err) => {
          console.warn(`Webhook dispatch to ${url} failed:`, err.message);
        });
      }
    }

    return item;
  }
}
