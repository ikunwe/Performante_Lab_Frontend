/// <reference types="node" />
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { File as NodeFile, Blob as NodeBlob } from 'node:buffer';
import { AUTH_CONFIG } from '../auth/auth-client';
import { RequestDraftStorage, REQUEST_DRAFT_IDB, RequestDraftState } from './request-drafts.store';

describe('Persistent request drafts and images', () => {
  let database: IDBFactory;
  beforeEach(() => {
    database = new IDBFactory();
    vi.stubGlobal('File', NodeFile);
    vi.stubGlobal('Blob', NodeBlob);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });
  function setup(project = 'https://project.supabase.co') {
    TestBed.configureTestingModule({
      providers: [
        { provide: REQUEST_DRAFT_IDB, useValue: database },
        { provide: AUTH_CONFIG, useValue: async () => ({ supabaseUrl: project }) },
      ],
    });
    return TestBed.inject(RequestDraftStorage);
  }
  function state(): RequestDraftState {
    return {
      drafts: [
        {
          id: 'draft',
          kind: 'brand',
          title: 'Draft brand',
          brandId: '',
          modelId: '',
          brandName: '',
          modelName: '',
          manufacturer: '',
          description: 'Notes',
          source: '',
          createdAt: new Date().toISOString(),
          photos: [
            {
              id: 'image',
              file: new File([new Uint8Array([1, 2, 3, 4])], 'logo.png', {
                type: 'image/png',
                lastModified: 12345,
              }),
            },
          ],
        },
      ],
      editor: null,
      editingId: null,
      submissionId: 'retry-id',
      submissionKey: 'same-payload',
    };
  }
  it('restores text and exact image bytes/metadata with a new storage instance after navigation or reload', async () => {
    await setup().save('owner', state());
    TestBed.resetTestingModule();
    const result = await setup().load('owner');
    expect(result?.drafts[0].title).toBe('Draft brand');
    const file = result!.drafts[0].photos[0].file;
    expect(file.name).toBe('logo.png');
    expect(file.type).toBe('image/png');
    expect(file.lastModified).toBe(12345);
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3, 4]);
    expect(result?.submissionId).toBe('retry-id');
  });
  it('isolates accounts and projects and serializes a final navigation flush before restoring', async () => {
    const storage = setup();
    const first = state(),
      latest = state();
    latest.drafts[0].title = 'Latest';
    const a = storage.save('owner', first),
      b = storage.save('owner', latest),
      read = storage.load('owner');
    await Promise.all([a, b]);
    expect((await read)?.drafts[0].title).toBe('Latest');
    expect(await storage.load('other-owner')).toBeNull();
    TestBed.resetTestingModule();
    expect(await setup('https://other.supabase.co').load('owner')).toBeNull();
  });
  it('keeps unsaved editor attachments and removes state after the last draft is submitted/deleted', async () => {
    const storage = setup(),
      draft = state().drafts[0];
    await storage.save('owner', {
      ...state(),
      drafts: [],
      editor: { ...draft, title: '' },
      editingId: null,
    });
    expect((await storage.load('owner'))?.editor?.photos[0].file.size).toBe(4);
    await storage.save('owner', { ...state(), drafts: [], editor: null });
    expect(await storage.load('owner')).toBeNull();
  });
  it('reports unavailable browser storage rather than claiming the draft was saved', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: REQUEST_DRAFT_IDB, useValue: undefined },
        { provide: AUTH_CONFIG, useValue: async () => ({ supabaseUrl: 'project' }) },
      ],
    });
    await expect(TestBed.inject(RequestDraftStorage).save('owner', state())).rejects.toThrow(
      'ไม่รองรับ',
    );
  });
});
