import { Injectable, InjectionToken, inject } from '@angular/core';
import { AUTH_CONFIG } from '../auth/auth-client';
import { AuthService } from '../auth/auth.service';

export type RequestKind = 'brand' | 'model' | 'bodykit' | 'part';
export interface RequestRecord {
  id: string;
  title: string;
  kind: RequestKind;
  description: string;
  brandName: string;
  modelName: string;
  manufacturer: string;
  source: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Cancelled';
  images: string[];
  author: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt: string;
}
export interface RequestSubmission {
  id: string;
  kind: RequestKind;
  title: string;
  brandId: string;
  modelId: string;
  brandName: string;
  modelName: string;
  manufacturer: string;
  description: string;
  source: string;
}
export const REQUEST_FETCH = new InjectionToken<typeof fetch>('REQUEST_FETCH', {
  providedIn: 'root',
  factory: () => fetch.bind(globalThis),
});
@Injectable({ providedIn: 'root' })
export class RequestsApi {
  private readonly auth = inject(AuthService);
  private readonly config = inject(AUTH_CONFIG);
  private readonly fetch = inject(REQUEST_FETCH);
  private async call<T>(path: string, method = 'GET', body?: FormData | object): Promise<T> {
    const session = await this.auth.apiSession();
    const config = await this.config();
    if (this.auth.user()?.id !== session.userId)
      throw new Error('บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้านี้ใหม่');
    const multipart = body instanceof FormData;
    let response: Response;
    try {
      response = await this.fetch(config.apiBaseUrl.replace(/\/$/, '') + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + session.accessToken,
          ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: multipart ? (body as FormData) : JSON.stringify(body) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(multipart ? 120000 : 30000),
      });
    } catch {
      throw new Error('เชื่อมต่อระบบคำขอไม่สำเร็จ กรุณาลองใหม่');
    }
    if (this.auth.user()?.id !== session.userId)
      throw new Error('บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้านี้ใหม่');
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(
        error?.message ||
          (response.status === 429
            ? 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่'
            : 'โหลดหรือบันทึกคำขอไม่สำเร็จ'),
      );
    }
    return response.json();
  }
  async list(admin = false): Promise<RequestRecord[]> {
    const owner = this.auth.user()?.id;
    const result: RequestRecord[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: { requests: RequestRecord[]; nextOffset: number | null } = await this.call(
        (admin ? '/api/admin/requests' : '/api/requests') + '?offset=' + offset,
      );
      if (owner !== this.auth.user()?.id) throw new Error('บัญชีเปลี่ยนแล้ว');
      if (
        !Array.isArray(page.requests) ||
        (page.nextOffset !== null &&
          (!Number.isInteger(page.nextOffset) ||
            page.nextOffset <= offset ||
            page.nextOffset > 10000))
      )
        throw new Error('รูปแบบข้อมูลคำขอไม่ถูกต้อง');
      result.push(...page.requests);
      offset = page.nextOffset;
    }
    return result;
  }
  async submit(data: RequestSubmission, images: File[]): Promise<RequestRecord> {
    const body = new FormData();
    body.append('data', JSON.stringify(data));
    for (const file of images) body.append('images', file, file.name);
    return (await this.call<{ request: RequestRecord }>('/api/requests', 'POST', body)).request;
  }
  async cancel(id: string): Promise<RequestRecord> {
    return (
      await this.call<{ request: RequestRecord }>(
        '/api/requests/' + encodeURIComponent(id) + '/cancel',
        'PATCH',
      )
    ).request;
  }
  async review(id: string, status: 'Accepted' | 'Rejected'): Promise<RequestRecord> {
    return (
      await this.call<{ request: RequestRecord }>(
        '/api/admin/requests/' + encodeURIComponent(id) + '/status',
        'PATCH',
        { status },
      )
    ).request;
  }
}
