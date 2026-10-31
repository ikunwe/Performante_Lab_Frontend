import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi, afterEach } from 'vitest';
import { StorageCatalogStore } from '../../core/catalog/storage-catalog';
import { UserRequests } from './user-requests';

describe('User Requests UI', () => {
  const load = vi.fn(async () => {});
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${crypto.randomUUID()}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
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

  it('requires title, compatible car context and a photo before review', () => {
    const page = TestBed.createComponent(UserRequests).componentInstance;
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

  it('previews files and saves only explicitly labelled local drafts', () => {
    const fixture = TestBed.createComponent(UserRequests);
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
    page.saveDraft();
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

  it('rejects unsupported and oversized files, caps attachments and releases removed previews', () => {
    const page = TestBed.createComponent(UserRequests).componentInstance;
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
});
