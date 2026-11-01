import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { AUTH_CONFIG } from '../../../core/auth/auth-client';
import { AdminBuildsApi, ADMIN_BUILDS_FETCH } from './admin-builds.api';
describe('Admin Build transport', () => {
  function setup() {
    const request = vi.fn(),
      auth = {
        user: signal({ id: 'admin' }),
        apiSession: vi.fn().mockResolvedValue({ userId: 'admin', accessToken: 'token' }),
      };
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminBuildsApi, useClass: AdminBuildsApi },
        { provide: ADMIN_BUILDS_FETCH, useValue: request },
        { provide: AuthService, useValue: auth },
        { provide: AUTH_CONFIG, useValue: async () => ({ apiBaseUrl: 'https://api.test' }) },
      ],
    });
    return { api: TestBed.inject(AdminBuildsApi), request, auth };
  }
  it('reads every page from the Admin backend with a fresh token and accepts empty database results', async () => {
    const { api, request } = setup();
    request
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ builds: [{ id: 'real' }], nextOffset: 100 })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ builds: [], nextOffset: null })));
    expect(await api.list()).toEqual([{ id: 'real' }]);
    expect(request.mock.calls[0][0]).toBe('https://api.test/api/admin/builds?offset=0');
    expect(request.mock.calls[1][1].headers.Authorization).toBe('Bearer token');
    request.mockResolvedValueOnce(new Response(JSON.stringify({ builds: [], nextOffset: null })));
    expect(await api.list()).toEqual([]);
  });
  it('reports outages instead of falling back to local mock builds', async () => {
    const { api, request } = setup();
    request.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'offline' }), { status: 503 }),
    );
    await expect(api.list()).rejects.toThrow('offline');
  });
});
