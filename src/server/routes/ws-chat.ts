import { defineWebSocketHandler } from 'h3';
import { markMessageRead, sendMessage } from '../services/chat-repository';

type Peer = { userId?: number };

const peers = new Map<any, Peer>();

function broadcastToUser(userId: number, payload: unknown): void {
  for (const [peer, state] of peers.entries()) {
    if (state.userId === userId) {
      peer.send(JSON.stringify(payload));
    }
  }
}

function broadcastToAll(payload: unknown): void {
  for (const [peer] of peers.entries()) {
    peer.send(JSON.stringify(payload));
  }
}

export default defineWebSocketHandler({
  open(peer) {
    peers.set(peer, {});
  },
  async message(peer, message) {
    try {
      const raw = typeof message.text === 'function' ? message.text() : '';
      if (!raw) return;
      const frame = JSON.parse(raw);
      const destination = String(frame?.destination || frame?.action || '');
      const body = frame?.body ?? frame?.payload ?? {};

      if (destination.includes('chat.connect')) {
        const userId = Number(body.userId);
        peers.set(peer, { userId });
        broadcastToAll({ userId, status: 'online' });
        return;
      }

      if (destination.includes('chat.send')) {
        const sent = await sendMessage(Number(body.senderId), Number(body.receiverId), String(body.content || ''));
        broadcastToUser(Number(body.senderId), sent.message);
        broadcastToUser(Number(body.receiverId), sent.message);
        return;
      }

      if (destination.includes('chat.read')) {
        await markMessageRead(Number(body.messageId));
        const receipt = { messageId: Number(body.messageId), isRead: true };
        broadcastToUser(Number(body.receiverId), receipt);
        return;
      }

      if (destination.includes('chat.typing')) {
        const senderId = Number(body.senderId);
        const receiverId = Number(body.receiverId);
        const isTyping = Boolean(body.isTyping);
        broadcastToUser(receiverId, { senderId, isTyping });
        return;
      }

      if (destination.includes('chat.disconnect')) {
        const userId = Number(body.userId);
        broadcastToAll({ userId, status: 'offline' });
        peers.delete(peer);
        return;
      }
    } catch {
      // Keep socket alive on bad frame.
    }
  },
  close(peer) {
    const current = peers.get(peer);
    if (current?.userId) {
      broadcastToAll({ userId: current.userId, status: 'offline' });
    }
    peers.delete(peer);
  },
});
