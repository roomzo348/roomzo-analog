import { describe, expect, it } from 'vitest';
import { endpointManifest, websocketManifest } from './endpoint-manifest';

describe('backend migration manifest', () => {
  it('covers minimum endpoint parity count', () => {
    expect(endpointManifest.length).toBeGreaterThanOrEqual(50);
  });

  it('includes critical listing and auth contracts', () => {
    expect(endpointManifest).toContain('GET /listings/searchWithFilters');
    expect(endpointManifest).toContain('POST /listings/add');
    expect(endpointManifest).toContain('POST /api/auth/login');
    expect(endpointManifest).toContain('GET /api/auth/owner-info/:ownerId');
  });

  it('defines websocket compatibility surface', () => {
    expect(websocketManifest.endpoint).toBe('/ws-chat');
    expect(websocketManifest.appDestinations).toContain('/app/chat.send');
    expect(websocketManifest.userTopicPattern).toBe('/topic/messages.{userId}');
  });
});
