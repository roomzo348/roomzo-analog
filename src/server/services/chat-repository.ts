import { sqlExecute, sqlQuery } from '../db/mysql';

function otherUser(conversation: any, userId: number) {
  const isUser1 = Number(conversation.user1Id) === Number(userId);
  return {
    otherUserId: isUser1 ? conversation.user2Id : conversation.user1Id,
    otherUserName: isUser1 ? conversation.user2Name : conversation.user1Name,
  };
}

function preferredUserName(user: any): string {
  return (
    user?.displayName ||
    user?.name ||
    user?.email ||
    user?.phone ||
    `User ${user?.id ?? ''}`
  );
}

export async function getConversations(userId: number): Promise<any[]> {
  const rows = await sqlQuery<any>(
    `SELECT c.id, c.user1_id as user1Id, c.user2_id as user2Id, c.last_message_time as lastMessageTime, c.is_accepted as isAccepted,
            u1.id as user1UserId, u1.display_name as user1DisplayName, u1.name as user1Name, u1.email as user1Email, u1.phone as user1Phone,
            u2.id as user2UserId, u2.display_name as user2DisplayName, u2.name as user2Name, u2.email as user2Email, u2.phone as user2Phone,
            m.content as lastMessageContent,
            (SELECT COUNT(*) FROM messages mu WHERE mu.sender_id = IF(c.user1_id = ?, c.user2_id, c.user1_id) AND mu.receiver_id = ? AND COALESCE(mu.is_read, 0) = 0) as unreadCount
     FROM conversations c
     JOIN users u1 ON u1.id = c.user1_id
     JOIN users u2 ON u2.id = c.user2_id
     LEFT JOIN messages m ON m.id = c.last_message_id
     WHERE c.user1_id = ? OR c.user2_id = ?
     ORDER BY c.last_message_time DESC, c.created_at DESC`,
    [userId, userId, userId, userId]
  );
  return rows.map((row) => {
    const peer = otherUser(row, userId);
    const otherUserRecord =
      Number(row.user1Id) === Number(peer.otherUserId)
        ? {
            id: row.user1UserId,
            displayName: row.user1DisplayName,
            name: row.user1Name,
            email: row.user1Email,
            phone: row.user1Phone,
          }
        : {
            id: row.user2UserId,
            displayName: row.user2DisplayName,
            name: row.user2Name,
            email: row.user2Email,
            phone: row.user2Phone,
          };
    return {
      conversationId: row.id,
      ...peer,
      otherUserName: preferredUserName(otherUserRecord),
      otherUserPhone: otherUserRecord.phone ?? null,
      lastMessage: row.lastMessageContent,
      lastMessageTime: row.lastMessageTime,
      isAccepted:
        Number(row.user1Id) === Number(userId)
          ? true
          : Number(row.isAccepted ?? 0) === 1,
      unreadCount: Number(row.unreadCount ?? 0),
    };
  });
}

export async function getMessageHistory(senderId: number, receiverId: number): Promise<any[]> {
  return sqlQuery<any>(
    `SELECT id, sender_id as senderId, receiver_id as receiverId, content, created_at as createdAt, is_read as isRead
     FROM messages
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
     ORDER BY created_at ASC`,
    [senderId, receiverId, receiverId, senderId]
  );
}

async function getOrCreateConversation(senderId: number, receiverId: number): Promise<number> {
  const rows = await sqlQuery<{ id: number }>(
    `SELECT id FROM conversations
     WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
     LIMIT 1`,
    [senderId, receiverId, receiverId, senderId]
  );
  if (rows[0]) return Number(rows[0].id);
  const result = await sqlExecute(
    `INSERT INTO conversations (user1_id, user2_id, is_accepted, created_at, last_message_time)
     VALUES (?, ?, 0, NOW(), NOW())`,
    [senderId, receiverId]
  );
  return Number(result.insertId);
}

export async function sendMessage(senderId: number, receiverId: number, content: string): Promise<any> {
  if (senderId === receiverId) {
    throw new Error('You cannot send a message to yourself.');
  }
  const conversationId = await getOrCreateConversation(senderId, receiverId);
  const msg = await sqlExecute(
    `INSERT INTO messages (sender_id, receiver_id, content, created_at, is_read, is_deleted)
     VALUES (?, ?, ?, NOW(), 0, 0)`,
    [senderId, receiverId, content]
  );
  const messageId = Number(msg.insertId);
  await sqlExecute(
    `UPDATE conversations SET last_message_id = ?, last_message_time = NOW() WHERE id = ?`,
    [messageId, conversationId]
  );
  const rows = await sqlQuery<any>(
    `SELECT id, sender_id as senderId, receiver_id as receiverId, content, created_at as createdAt, is_read as isRead
     FROM messages WHERE id = ? LIMIT 1`,
    [messageId]
  );
  return { conversationId, message: rows[0] };
}

export async function markMessageRead(messageId: number): Promise<boolean> {
  const result = await sqlExecute(
    `UPDATE messages SET is_read = 1, read_at = NOW() WHERE id = ?`,
    [messageId]
  );
  return result.affectedRows > 0;
}

export async function acceptConversation(conversationId: number): Promise<boolean> {
  const result = await sqlExecute(
    `UPDATE conversations SET is_accepted = 1 WHERE id = ?`,
    [conversationId]
  );
  return result.affectedRows > 0;
}
