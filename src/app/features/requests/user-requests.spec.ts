import { AuthService } from '../../core/auth/auth.service';
import { RequestDraftStorage } from '../../core/requests/request-drafts.store';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi, afterEach } from 'vitest';
import { StorageCatalogStore } from '../../core/catalog/storage-catalog';
import { RequestsApi } from '../../core/requests/requests.api';
import { UserRequests } from './user-requests';

describe('User Requests UI', async () => {
  const load = vi.fn(async () => {});
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${crypto.randomUUID()}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'draft-owner' }) } },
        {
          provide: RequestDraftStorage,
          useValue: {
            load: vi.fn().mockResolvedValue(null),
            save: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RequestsApi,
          useValue: { list: vi.fn().mockResolvedValue([]), submit: vi.fn() },
        },
        {
          provide: StorageCatalogStore,
          useValue: {
            load,
            loading: signal(false),
            error: signal(''),
            data: signal({
              brands: [
                { id: 'Honda', name: 'Honda' },
                { id: 'Toyota', name: 'Toyota' },
              ],
              cars: [
                { id: 'civic', modelName: 'Civic FE', storagePath: 'Honda/Civic-FE' },
                { id: 'gt86', modelName: 'GT86', storagePath: 'Toyota/GT86' },
              ],
            }),
          },
        },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });
  const photo = (name = 'bumper.png') => new File(['image'], name, { type: 'image/png' });
  async function create() {
    const fixture = TestBed.createComponent(UserRequests);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('requires title, compatible car context and a photo before review', async () => {
    const page = (await create()).componentInstance;
    page.review();
    expect(page.reviewing()).toBe(false);
    page.title.set('Mugen Front Bumper');
    page.chooseKind('part');
    page.review();
    expect(page.error()).toContain('แบรนด์');
    page.chooseBrand('Honda');
    expect(page.models().map((model) => model.id)).toEqual(['civic']);
    page.modelId.set('gt86');
    page.review();
    expect(page.error()).toContain('รุ่นรถ');
    page.modelId.set('civic');
    page.review();
    expect(page.error()).toContain('แนบ');
    page.addFiles([photo()]);
    page.review();
    expect(page.reviewing()).toBe(true);
    page.chooseBrand('Toyota');
    expect(page.modelId()).toBe('');
  });

  it('previews files and saves only explicitly labelled local drafts', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.title.set('New brand');
    page.addFiles([photo()]);
    page.source.set('javascript:alert(1)');
    page.review();
    expect(page.reviewing()).toBe(false);
    page.source.set('https://example.com');
    page.review();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ยังไม่ได้ส่ง');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toContain('blob:');
    await page.saveDraft();
    fixture.detectChanges();
    expect(page.drafts().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('ฉบับร่าง');
    expect(page.message()).toContain('ยังไม่ได้ส่ง');
    page.editDraft(page.drafts()[0]);
    expect(page.title()).toBe('New brand');
    expect(page.photos().length).toBe(1);
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('rejects unsupported and oversized files, caps attachments and releases removed previews', async () => {
    const page = (await create()).componentInstance;
    page.addFiles([new File(['text'], 'bad.svg', { type: 'image/svg+xml' })]);
    expect(page.photos()).toEqual([]);
    page.addFiles([
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
    ]);
    expect(page.photos()).toEqual([]);
    page.addFiles(Array.from({ length: 6 }, (_, i) => photo(`${i}.png`)));
    expect(page.photos().length).toBe(5);
    page.removePhoto(page.photos()[0].id);
    expect(page.photos().length).toBe(4);
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it('submits a reviewed request, blocks duplicate clicks and keeps input after failure for an idempotent retry', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    const api = TestBed.inject(RequestsApi);
    const send = vi.mocked(api.submit);
    page.title.set('New brand');
    page.addFiles([photo()]);
    page.review();
    let fail!: (error: Error) => void;
    send.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const pending = page.submit();
    await page.submit();
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(page.submitting()).toBe(true);
    fail(new Error('offline'));
    await pending;
    expect(page.reviewing()).toBe(true);
    expect(page.title()).toBe('New brand');
    expect(page.error()).toBe('offline');
    const request = {
      ...send.mock.calls[0][0],
      status: 'Pending' as const,
      images: ['https://test/signed.png'],
      author: 'Driver',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    send.mockResolvedValueOnce(request);
    await page.submit();
    expect(send.mock.calls[1][0].id).toBe(send.mock.calls[0][0].id);
    expect(page.submitted()[0].status).toBe('Pending');
    expect(page.tab()).toBe('mine');
    expect(page.photos()).toEqual([]);
    expect(page.message()).toContain('ส่งคำขอให้ผู้ดูแลแล้ว');
  });
  it('does not let an older list response hide a request submitted in the meantime', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    const api = TestBed.inject(RequestsApi);
    let resolve!: (rows: never[]) => void;
    vi.mocked(api.list).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const loading = page.loadRequests();
    page.title.set('New brand');
    page.addFiles([photo()]);
    vi.mocked(api.submit).mockImplementationOnce(async (data) => ({
      ...data,
      status: 'Pending',
      images: [],
      author: 'Driver',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await page.submit();
    resolve([]);
    await loading;
    expect(page.submitted()).toHaveLength(1);
    expect(page.loadingRequests()).toBe(false);
  });
  it('restores saved drafts and creates new image previews after leaving the page', async () => {
    const fixture = await create(),
      page = fixture.componentInstance;
    const storage = TestBed.inject(RequestDraftStorage);
    page.title.set('Saved brand');
    page.addFiles([photo('logo.png')]);
    const oldUrl = page.photos()[0].url;
    await page.saveDraft();
    const state = vi.mocked(storage.save).mock.calls.at(-1)![1];
    expect(state.drafts[0].photos[0].file.name).toBe('logo.png');
    fixture.destroy();
    vi.mocked(storage.load).mockResolvedValueOnce(state);
    const returned = await create();
    expect(returned.componentInstance.drafts()[0].title).toBe('Saved brand');
    expect(returned.componentInstance.drafts()[0].photos[0].url).not.toBe(oldUrl);
    returned.componentInstance.editDraft(returned.componentInstance.drafts()[0]);
    expect(returned.componentInstance.photos()[0].file.name).toBe('logo.png');
  });
  it('persists incomplete form data with attachments and keeps input when local storage fails', async () => {
    const fixture = await create(),
      page = fixture.componentInstance;
    const storage = TestBed.inject(RequestDraftStorage);
    page.description.set('Unfinished notes');
    page.addFiles([photo()]);
    await page.persistDrafts();
    const snapshot = vi.mocked(storage.save).mock.calls.at(-1)![1];
    expect(snapshot.editor?.description).toBe('Unfinished notes');
    expect(snapshot.editor?.photos.length).toBe(1);
    page.title.set('Brand');
    vi.mocked(storage.save).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await page.saveDraft();
    expect(page.title()).toBe('Brand');
    expect(page.photos().length).toBe(1);
    expect(page.draftStorageError()).toContain('ยังบันทึกฉบับร่างไม่ได้');
  });
  it('does not send old-account form data after switching accounts during a draft flush', async () => {
    const fixture=await create(),page=fixture.componentInstance;
    const storage=TestBed.inject(RequestDraftStorage),api=TestBed.inject(RequestsApi);
    page.title.set('Private draft');page.addFiles([photo()]);
    let finish!: ()=>void;
    vi.mocked(storage.save).mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const pending=page.submit();
    (TestBed.inject(AuthService).user as unknown as {set(value:{id:string}):void}).set({id:'other-owner'});
    fixture.detectChanges();await fixture.whenStable();finish();await pending;
    expect(api.submit).not.toHaveBeenCalled();
    expect(page.title()).toBe('');expect(page.photos()).toEqual([]);
  });

});
