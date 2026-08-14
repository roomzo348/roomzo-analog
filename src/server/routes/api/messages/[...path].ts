import { defineEventHandler, getMethod, getQuery, getRouterParam } from 'h3';
import { acceptConversation, getConversations, getMessageHistory } from '../../../services/chat-repository';
import { apiResponse } from '../../../utils/api-response';

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);
  const query = getQuery(event);

  if (segments[0] === 'conversations' && segments[1] && method === 'GET') {
    const data = await getConversations(Number(segments[1]));
    return apiResponse(1, 'Conversations fetched', data);
  }

  if (segments[0] === 'history' && method === 'GET') {
    const senderId = Number(query.senderId);
    const receiverId = Number(query.receiverId);
    const data = await getMessageHistory(senderId, receiverId);
    return apiResponse(1, 'Message history fetched', data);
  }

  if (segments[0] === 'conversations' && segments[1] && segments[2] === 'accept' && method === 'PUT') {
    const ok = await acceptConversation(Number(segments[1]));
    return apiResponse(ok ? 1 : 0, ok ? 'Conversation accepted' : 'Conversation not found');
  }

  return apiResponse(0, 'Endpoint not implemented');
});
