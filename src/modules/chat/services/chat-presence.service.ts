import { Injectable } from '@nestjs/common';

interface PresenceState {
  connections: number;
  lastSeenAt: Date | null;
}

@Injectable()
export class ChatPresenceService {
  private readonly presences = new Map<string, PresenceState>();

  markConnected(userId: string): void {
    const current = this.presences.get(userId);

    this.presences.set(userId, {
      connections: (current?.connections ?? 0) + 1,
      lastSeenAt: current?.lastSeenAt ?? null,
    });
  }

  markDisconnected(userId: string): void {
    const current = this.presences.get(userId);

    if (!current) {
      return;
    }

    const connections = Math.max(0, current.connections - 1);

    this.presences.set(userId, {
      connections,
      lastSeenAt: connections === 0 ? new Date() : current.lastSeenAt,
    });
  }

  isOnline(userId: string): boolean {
    return (this.presences.get(userId)?.connections ?? 0) > 0;
  }

  getLastSeenAt(userId: string): Date | null {
    return this.presences.get(userId)?.lastSeenAt ?? null;
  }
}
