import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { AUTH_CONFIG } from '../auth/auth-client';
import { RequestsApi, REQUEST_FETCH } from './requests.api';
function setup() {
  const request = vi.fn();
  const auth = {
    user: signal({ id: 'owner' }),
    apiSession: vi.fn().mockResolvedValue({ userId: 'owner', accessToken: 'token' }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: REQUEST_FETCH, useValue: request },
      { provide: AuthService, useValue: auth },
      { provide: AUTH_CONFIG, useValue: async () => ({ apiBaseUrl: 'https://api.example.test' }) },
    ],
  });
  return { api: TestBed.inject(RequestsApi), request, auth };
}
describe('Requests transport', () => {
  it('sends multipart images with a session token and lets the browser set the boundary', async () => {
    const { api, request } = setup();
    request.mockResolvedValue(new Response(JSON.stringify({ request: { id: 'one' } })));
    await api.submit(
      {
        id: 'one',
        kind: 'brand',
        title: 'New',
        brandId: '',
        modelId: '',
        brandName: '',
        modelName: '',
        manufacturer: '',
        description: '',
        source: '',
      },
      [new File(['image'], 'logo.png', { type: 'image/png' })],
    );
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/requests');
    expect(options.headers).toEqual({ Authorization: 'Bearer token' });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.getAll('images')).toHaveLength(1);
    expect(JSON.parse(options.body.get('data')).title).toBe('New');
  });
  it('uses the Admin route for paginated reads and status reviews', async () => {
    const { api, request } = setup();
    request
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requests: [{ id: 'one' }], nextOffset: 100 })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ requests: [], nextOffset: null })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request: { id: 'one', status: 'Accepted' } })),
      );
    expect(await api.list(true)).toEqual([{ id: 'one' }]);
    expect(request.mock.calls[1][0]).toContain('/api/admin/requests?offset=100');
    expect((await api.review('one', 'Accepted')).status).toBe('Accepted');
    expect(request.mock.calls[2][1].method).toBe('PATCH');
  });
  it('rejects a response after the account changes', async () => {
    const { api, request, auth } = setup();
    request.mockImplementationOnce(async () => {
      auth.user.set({ id: 'other' });
      return new Response(JSON.stringify({ requests: [], nextOffset: null }));
    });
    await expect(api.list()).rejects.toThrow('บัญชีเปลี่ยนแล้ว');
  });
});
