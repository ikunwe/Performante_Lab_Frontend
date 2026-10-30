import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { BuildsApi, BUILD_FETCH } from './builds.api';
import { AUTH_CONFIG } from '../../core/auth/auth-client';
import { AuthService } from '../../core/auth/auth.service';

describe('Build API transport', () => {
  function setup() {
    const request = vi.fn();
    const auth = {
      user: signal({ id: 'account-a' }),
      initialize: vi.fn().mockResolvedValue(undefined),
      apiSession: vi
        .fn()
        .mockResolvedValue({ userId: 'account-a', accessToken: 'refreshed-token' }),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: BUILD_FETCH, useValue: request },
        { provide: AuthService, useValue: auth },
        {
          provide: AUTH_CONFIG,
          useValue: async () => ({
            apiBaseUrl: 'https://api.example.test',
            supabaseUrl: '',
            supabasePublishableKey: '',
          }),
        },
      ],
    });
    return { api: TestBed.inject(BuildsApi), request, auth };
  }
  it('sends the current access token to the backend and omits client car snapshots', async () => {
    const { api, request } = setup();
    request.mockResolvedValue(new Response(JSON.stringify({ build: { id: 'created' } })));
    await api.save(
      'account-a',
      {
        name: 'My build',
        carId: 'ref:honda:civic',
        partIds: [],
        carSnapshot: { id: 'forged', name: 'forged', brand: '', image: '', body: '' },
      },
      'create-id',
    );
    expect(request.mock.calls[0][0]).toBe('https://api.example.test/api/builds');
    const options = request.mock.calls[0][1];
    expect(options.headers.Authorization).toBe('Bearer refreshed-token');
    expect(JSON.parse(options.body)).toEqual({
      id: 'create-id',
      name: 'My build',
      carId: 'ref:honda:civic',
      partIds: [],
    });
    expect(options.cache).toBe('no-store');
  });
  it('paginates all builds and refuses to send a different account token', async () => {
    const { api, request, auth } = setup();
    request
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ builds: [{ id: 'one' }], nextOffset: 100 })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ builds: [{ id: 'two' }], nextOffset: null })),
      );
    expect((await api.list('account-a')).map((build) => build.id)).toEqual(['one', 'two']);
    expect(request.mock.calls[1][0]).toContain('offset=100');
    auth.apiSession.mockResolvedValue({ userId: 'account-b', accessToken: 'other-token' });
    await expect(api.remove('account-a', 'one')).rejects.toThrow('บัญชีเปลี่ยนแล้ว');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
