import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PartCropEditor } from './part-crop-editor';
import { PartMaskUpload } from './part-mask-upload';
import { CROP_EDITOR_IMAGES } from './part-crop-image';
import { StorageCatalogStore, storageCatalogData } from '../../../core/catalog/storage-catalog';
import { defaultPlacement, validPlacements } from './part-placement';
import { cropBounds, resizeCrop, defaultCrops, validCrops } from './crop-regions';
import { AdminService } from '../services/admin.service';
import { CatalogStorageHelper } from '../../../core/storage/catalog-storage';
describe('Part source crop editor', () => {
  afterEach(() => vi.restoreAllMocks());
  it('moves/resizes regions within the source frame and rejects malformed saved geometry', () => {
    const [first, second] = defaultCrops('wheels');
    const moved = resizeCrop(first, { x: 0.4, y: 0.2, width: 0.2, height: 0.3 });
    expect(cropBounds(moved).x).toBeCloseTo(0.4);
    expect(cropBounds(moved).y).toBeCloseTo(0.2);
    expect(cropBounds(moved).width).toBeCloseTo(0.2);
    expect(cropBounds(moved).height).toBeCloseTo(0.3);
    expect(cropBounds(second).x).toBeCloseTo(0.63);
    const bounded = cropBounds(resizeCrop(first, { x: -5, y: 10, width: 0.2, height: 0.3 }));
    expect(bounded.x).toBe(0);
    expect(bounded.y).toBeCloseTo(0.7);
    expect(validCrops([moved, second])).toBe(true);
    expect(validCrops([])).toBe(false);
    expect(
      validCrops([
        {
          kind: 'polygon',
          points: [
            [0, 0],
            [1, 0],
            [NaN, 1],
          ],
        },
      ]),
    ).toBe(false);
  });
  it('drags one wheel crop independently and exports selected pixels without moving/rescaling the original photo', async () => {
    const image = { naturalWidth: 1800, naturalHeight: 900 };
    TestBed.configureTestingModule({
      providers: [{ provide: CROP_EDITOR_IMAGES, useValue: async () => image }],
    });
    const fixture = TestBed.createComponent(PartCropEditor),
      page = fixture.componentInstance;
    fixture.componentRef.setInput('source', 'original-wheel.png');
    fixture.componentRef.setInput('category', 'wheels');
    fixture.detectChanges();
    await vi.waitFor(() => expect(page.loading()).toBe(false));
    fixture.detectChanges();
    const second = structuredClone(page.regions()[1]),
      firstBefore = cropBounds(page.regions()[0]);
    const svg = fixture.nativeElement.querySelector('svg[aria-label="ภาพต้นฉบับและกรอบตัด"]');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 900,
      height: 450,
    });
    const shape = svg.querySelector('ellipse');
    page.begin(
      {
        button: 0,
        currentTarget: shape,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as any,
      0,
    );
    page.drag({ currentTarget: svg, clientX: 145, clientY: 100 } as any);
    page.end();
    expect(cropBounds(page.regions()[0]).x).toBeCloseTo(firstBefore.x + 0.05);
    expect(page.regions()[1]).toEqual(second);
    expect(svg.querySelector('image').getAttribute('href')).toBe('original-wheel.png');
    const draw = vi.fn(),
      translate = vi.fn();
    const context = {
      drawImage: draw,
      translate,
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['png'], { type: 'image/png' })),
    );
    const saved = vi.fn();
    page.save.subscribe(saved);
    await page.export();
    expect(saved).toHaveBeenCalledOnce();
    expect(saved.mock.calls[0][0].regions).toEqual(page.regions());
    expect(draw).toHaveBeenCalledWith(image, 0, 0, 1800, 900);
    expect(translate).not.toHaveBeenCalled();
    fixture.destroy();
  });
  it('moves, scales and rotates one placed wheel without changing the source crop or second wheel, and exports full-opacity frames', async () => {
    const image = { naturalWidth: 1800, naturalHeight: 900 };
    const ctx = {
      drawImage: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['png'], { type: 'image/png' })),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: CROP_EDITOR_IMAGES, useValue: async () => image }],
    });
    const fixture = TestBed.createComponent(PartCropEditor),
      page = fixture.componentInstance;
    fixture.componentRef.setInput('source', 'wheel');
    fixture.componentRef.setInput('reference', 'default');
    fixture.componentRef.setInput('category', 'wheels');
    fixture.detectChanges();
    await vi.waitFor(() => expect(page.loading()).toBe(false));
    fixture.detectChanges();
    const regions = structuredClone(page.regions());
    page.setMode('place');
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg[aria-label="ลากพาร์ทเพื่อจัดวางบนรถ"]');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 900, height: 450 } as any);
    page.beginPlacement(
      {
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        currentTarget: svg,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any,
      0,
    );
    page.dragPlacement({ clientX: 145, clientY: 145, pointerId: 1, currentTarget: svg } as any);
    page.end();
    page.adjustPlacement('scale', { target: { value: 1.2 } } as any);
    page.adjustPlacement('rotation', { target: { value: 15 } } as any);
    expect(page.placements()[0]).toEqual({ x: 0.05, y: 0.1, scale: 1.2, rotation: 15 });
    expect(page.placements()[1]).toEqual(defaultPlacement());
    expect(page.regions()).toEqual(regions);
    page.placementOpacity({ target: { value: 0.3 } } as any);
    const saved = vi.fn();
    page.save.subscribe(saved);
    ctx.rotate.mockClear();
    ctx.scale.mockClear();
    await page.export();
    expect(saved).toHaveBeenCalledOnce();
    expect(saved.mock.calls[0][0].placements).toEqual(page.placements());
    expect(saved.mock.calls[0][0]).not.toHaveProperty('opacity');
    // Both the mask and pixels receive the same rotation and scale, around the crop centre.
    expect(ctx.rotate.mock.calls.filter(([r]) => r === (15 * Math.PI) / 180)).toHaveLength(2);
    expect(ctx.scale.mock.calls.filter(([x, y]) => x === 1.2 && y === 1.2)).toHaveLength(2);
    page.resetPlacement();
    expect(page.placements()).toEqual([defaultPlacement(), defaultPlacement()]);
    page.beginPlacement(
      {
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 2,
        currentTarget: svg,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any,
      0,
      'x',
    );
    page.dragPlacement({ clientX: 163, clientY: 100, pointerId: 2, currentTarget: svg } as any);
    page.end();
    expect(page.placements()[0].scaleX).toBeCloseTo(2);
    expect(page.placements()[0].scaleY).toBe(1);
    expect(page.placements()[1]).toEqual(defaultPlacement());
    page.adjustPlacement('scaleY', { target: { value: 0.7 } } as any);
    expect(page.placementTransform(0)).toContain('scale(2 0.7)');
    ctx.scale.mockClear();
    await page.export();
    expect(ctx.scale.mock.calls.filter(([x, y]) => x === 2 && y === 0.7)).toHaveLength(2);
    expect(saved.mock.calls[1][0].placements[0]).toMatchObject({ scaleX: 2, scaleY: 0.7 });
    const position = structuredClone(page.placements());
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b: any) =>
      b.textContent.includes('ซ่อนกรอบ'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('svg[aria-label="ลากพาร์ทเพื่อจัดวางบนรถ"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('canvas').classList.contains('hidden')).toBe(false);
    expect(page.placements()).toEqual(position);
    expect(button.textContent).toContain('แสดงกรอบ');
    button.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('svg[aria-label="ลากพาร์ทเพื่อจัดวางบนรถ"]'),
    ).not.toBeNull();
    expect(validPlacements([{ ...defaultPlacement(), scaleX: NaN }], 1)).toBe(false);
    expect(validPlacements([{ ...defaultPlacement(), scaleY: 0 }], 1)).toBe(false);
    fixture.destroy();
  });
  it('zooms and pans the workspace without changing saved geometry and uses the zoomed SVG size for dragging', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CROP_EDITOR_IMAGES,
          useValue: async () => ({ naturalWidth: 1800, naturalHeight: 900 }),
        },
      ],
    });
    const fixture = TestBed.createComponent(PartCropEditor),
      page = fixture.componentInstance;
    fixture.componentRef.setInput('source', 'wheel');
    fixture.componentRef.setInput('category', 'wheels');
    fixture.detectChanges();
    await vi.waitFor(() => expect(page.loading()).toBe(false));
    fixture.detectChanges();
    const regions = structuredClone(page.regions()),
      placements = structuredClone(page.placements());
    const viewport = page.viewport()!.nativeElement;
    Object.defineProperties(viewport, {
      clientWidth: { value: 900 },
      clientHeight: { value: 450 },
    });
    page.setZoom(2);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(viewport.firstElementChild?.getAttribute('style')).toContain('width: 200%');
    expect(viewport.scrollLeft).toBe(450);
    expect(viewport.scrollTop).toBe(225);
    page.togglePan();
    page.beginPan({
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 3,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any);
    page.dragPan({ clientX: 200, clientY: 150, pointerId: 3 } as any);
    page.endPan();
    expect(viewport.scrollLeft).toBe(350);
    expect(viewport.scrollTop).toBe(175);
    expect(page.regions()).toEqual(regions);
    expect(page.placements()).toEqual(placements);
    page.togglePan();
    const svg = fixture.nativeElement.querySelector('svg[aria-label="ภาพต้นฉบับและกรอบตัด"]');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 1800, height: 900 } as any);
    const before = cropBounds(page.regions()[0]);
    page.begin(
      {
        button: 0,
        currentTarget: svg,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as any,
      0,
    );
    page.drag({ currentTarget: svg, clientX: 190, clientY: 100 } as any);
    page.end();
    expect(cropBounds(page.regions()[0]).x).toBeCloseTo(before.x + 0.05);
    expect(page.width()).toBe(1800);
    expect(page.height()).toBe(900);
    page.setZoom(1);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    expect(page.panMode()).toBe(false);
    fixture.destroy();
  });
  it('persists editable placements separately per angle and restores version 2 metadata', async () => {
    const regions = defaultCrops('wheels'),
      placements = [
        { x: 0.05, y: -0.02, scale: 1.1, scaleX: 1.3, scaleY: 0.9, rotation: 12 },
        defaultPlacement(),
      ];
    const metadata = new Map<string, unknown>();
    const info = vi.fn(async (path: string) => ({
      data: { metadata: metadata.get(path) },
      error: null,
    }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AdminService,
          useValue: { getClient: async () => ({ storage: { from: () => ({ info }) } }) },
        },
      ],
    });
    const upload = vi
      .spyOn(CatalogStorageHelper, 'uploadFile')
      .mockImplementation(async (_client, path, _file, _upsert, meta) => {
        if (meta) metadata.set(path, meta);
        return { ok: true, url: 'https://test/storage/v1/object/public/catalog/' + path };
      });
    const fixture = TestBed.createComponent(PartMaskUpload),
      page = fixture.componentInstance;
    const prefix = 'Honda/Civic/Part/Wheels/Brand/Wheel/';
    const url = 'https://test/storage/v1/object/public/catalog/';
    fixture.componentRef.setInput('source', url + prefix + '45_front.png');
    fixture.detectChanges();
    await page.saveDrawing({
      mask: new Blob(['mask']),
      photo: new Blob(['photo']),
      regions,
      placements,
    });
    expect(metadata.get(prefix + '45_front.mask.png')).toEqual({
      cropEditor: { version: 2, regions, placements },
    });
    fixture.componentRef.setInput('mask', 'saved-mask');
    fixture.detectChanges();
    await page.openCrop();
    expect(page.storedPlacements()).toEqual(placements);
    fixture.componentRef.setInput('source', url + prefix + '45_Back.png');
    fixture.componentRef.setInput('mask', '');
    fixture.detectChanges();
    await page.openCrop();
    expect(page.storedPlacements()).toEqual([]);
    const rear = [defaultPlacement(), { x: -0.03, y: 0.04, scale: 0.9, rotation: -8 }];
    await page.saveDrawing({
      mask: new Blob(['mask']),
      photo: new Blob(['photo']),
      regions,
      placements: rear,
    });
    expect(metadata.get(prefix + '45_Back.mask.png')).toEqual({
      cropEditor: { version: 2, regions, placements: rear },
    });
    expect(metadata.get(prefix + '45_front.mask.png')).toEqual({
      cropEditor: { version: 2, regions, placements },
    });
    expect(upload).toHaveBeenCalledTimes(4);
    expect(validPlacements([{ ...defaultPlacement(), scale: Infinity }], 1)).toBe(false);
    expect(validPlacements([{ ...defaultPlacement(), rotation: 181 }], 1)).toBe(false);
    fixture.destroy();
  });
  it('stores editable crop metadata with the PNG and restores it for another model without a preset', async () => {
    const regions = defaultCrops('wheels'),
      info = vi.fn().mockResolvedValue({
        data: { metadata: { cropEditor: { version: 1, regions } } },
        error: null,
      });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AdminService,
          useValue: { getClient: async () => ({ storage: { from: () => ({ info }) } }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(PartMaskUpload),
      page = fixture.componentInstance;
    fixture.componentRef.setInput(
      'source',
      'https://test.supabase.co/storage/v1/object/public/catalog/Toyota/Model/Part/Wheels/Brand/Wheel/45_front.png',
    );
    fixture.componentRef.setInput('modelName', 'Another model');
    fixture.componentRef.setInput('category', 'Wheels');
    fixture.componentRef.setInput('angle', '45_front');
    fixture.detectChanges();
    const upload = vi
      .spyOn(CatalogStorageHelper, 'uploadFile')
      .mockResolvedValue({ ok: true, url: 'https://saved.test/photo.png' });
    await page.saveDrawing({ mask: new Blob(['mask']), photo: new Blob(['part']), regions });
    expect(upload.mock.calls[1][4]).toEqual({ cropEditor: { version: 1, regions } });
    fixture.componentRef.setInput('mask', 'https://saved.test/mask.png');
    fixture.detectChanges();
    await page.openCrop();
    expect(page.cropOpen()).toBe(true);
    expect(page.storedCropRegions()).toEqual(regions);
    expect(page.canCrop()).toBe(true);
    expect(page.placementRegions()).toEqual([]);
    expect(info).toHaveBeenCalledWith('Toyota/Model/Part/Wheels/Brand/Wheel/45_front.mask.png');
    fixture.destroy();
  });
  it('keeps calibration for different bumper foundations separate and never replaces the general mask', async () => {
    const snapshot = storageCatalogData();
    const prefix = 'Honda/Civic/Part/Wheels/Brand/Wheel/';
    const url = 'https://test.supabase.co/storage/v1/object/public/catalog/';
    const a = 'storage-part:' + 'a'.repeat(32),
      b = 'storage-part:' + 'b'.repeat(32);
    const common = { carId: 'car', finish: 'Brand', description: '', crop: 'full' as const };
    storageCatalogData.set({
      ...snapshot,
      parts: [
        {
          ...common,
          id: 'wheel',
          category: 'wheels',
          name: 'Wheel',
          views: { front45: url + prefix + '45_front.png' },
        },
        {
          ...common,
          id: a,
          category: 'front',
          name: 'Bumper A',
          views: { front45: 'https://test/a.png' },
        },
        {
          ...common,
          id: b,
          category: 'front',
          name: 'Bumper B',
          views: { front45: 'https://test/b.png' },
        },
        {
          ...common,
          id: 'storage-part:' + 'c'.repeat(32),
          category: 'rear',
          name: 'Rear',
          views: { rear45: 'https://test/rear.png' },
        },
      ],
    });
    const metadata = new Map<string, unknown>();
    const info = vi.fn(async (path: string) => ({
      data: { metadata: metadata.get(path) },
      error: null,
    }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: StorageCatalogStore,
          useValue: { loading: () => false, error: () => '', load: vi.fn() },
        },
        {
          provide: AdminService,
          useValue: { getClient: async () => ({ storage: { from: () => ({ info }) } }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(PartMaskUpload),
      page = fixture.componentInstance;
    fixture.componentRef.setInput('source', url + prefix + '45_front.png');
    fixture.componentRef.setInput('category', 'Wheels');
    fixture.componentRef.setInput('angle', '45_front');
    fixture.detectChanges();
    const upload = vi
      .spyOn(CatalogStorageHelper, 'uploadFile')
      .mockImplementation(async (_client, path, _file, _upsert, meta) => {
        if (meta) metadata.set(path, meta);
        return { ok: true, url: url + path };
      });
    const saved = vi.fn();
    page.saved.subscribe(saved);
    const layerSaved = vi.fn();
    page.layerSaved.subscribe(layerSaved);
    expect(page.baseOptions().map((p) => p.id)).toEqual([a, b]);
    const regions = defaultCrops('wheels'),
      placements = [{ ...defaultPlacement(), x: 0.03 }, defaultPlacement()];
    page.chooseBase({ target: { value: a } } as any);
    expect(page.referenceImage()).toBe('https://test/a.png');
    await page.saveDrawing({
      mask: new Blob(['mask']),
      photo: new Blob(['photo']),
      regions,
      placements,
    });
    expect(upload.mock.calls[0][1]).toBe(prefix + '45_front.on-' + 'a'.repeat(32) + '.layer.png');
    expect(upload.mock.calls[1][1]).toBe(prefix + '45_front.on-' + 'a'.repeat(32) + '.mask.png');
    expect(saved).not.toHaveBeenCalled();
    expect(layerSaved).not.toHaveBeenCalled();
    page.chooseBase({ target: { value: b } } as any);
    expect(page.referenceImage()).toBe('https://test/b.png');
    await page.saveDrawing({
      mask: new Blob(['mask']),
      photo: new Blob(['photo']),
      regions,
      placements: regions.map(defaultPlacement),
    });
    page.chooseBase({ target: { value: a } } as any);
    await page.openCrop();
    expect(page.storedPlacements()).toEqual(placements);
    expect(metadata.size).toBe(2);
    expect(metadata.has(prefix + '45_front.mask.png')).toBe(false);
    fixture.destroy();
    storageCatalogData.set(snapshot);
  });
  it('reports metadata read errors instead of replacing a saved crop with an empty one', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AdminService,
          useValue: {
            getClient: async () => ({
              storage: {
                from: () => ({ info: async () => ({ data: null, error: { message: 'offline' } }) }),
              },
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PartMaskUpload),
      page = fixture.componentInstance;
    fixture.componentRef.setInput(
      'source',
      'https://test.supabase.co/storage/v1/object/public/catalog/Honda/Civic/Part/Spoilers/Brand/Wing/45_front.png',
    );
    fixture.componentRef.setInput('mask', 'https://test/mask.png');
    fixture.detectChanges();
    await page.openCrop();
    expect(page.cropOpen()).toBe(false);
    expect(page.message()).toContain('โหลดกรอบ');
    fixture.destroy();
  });
  it('saves generated frames beside the original, reports errors and does not emit false success', async () => {
    const client = {};
    TestBed.configureTestingModule({
      providers: [{ provide: AdminService, useValue: { getClient: async () => client } }],
    });
    const fixture = TestBed.createComponent(PartMaskUpload),
      page = fixture.componentInstance;
    fixture.componentRef.setInput(
      'source',
      'https://test.supabase.co/storage/v1/object/public/catalog/Honda/Civic/Part/Wheels/Enkei/Wheel-1/45_front.png',
    );
    fixture.detectChanges();
    const upload = vi
      .spyOn(CatalogStorageHelper, 'uploadFile')
      .mockResolvedValue({ ok: true, url: 'https://saved.test/image.png' });
    const saved = vi.fn(),
      layer = vi.fn();
    page.saved.subscribe(saved);
    page.layerSaved.subscribe(layer);
    const drawing = {
      mask: new Blob(['mask'], { type: 'image/png' }),
      photo: new Blob(['aligned'], { type: 'image/png' }),
    };
    await page.saveDrawing(drawing);
    expect(upload.mock.calls.map((c) => c[1])).toEqual([
      'Honda/Civic/Part/Wheels/Enkei/Wheel-1/45_front.layer.png',
      'Honda/Civic/Part/Wheels/Enkei/Wheel-1/45_front.mask.png',
    ]);
    expect(saved).toHaveBeenCalledOnce();
    expect(layer).toHaveBeenCalledOnce();
    expect(page.busy()).toBe(false);
    upload.mockResolvedValueOnce({ ok: false, error: 'Storage unavailable' });
    await page.saveDrawing(drawing);
    expect(saved).toHaveBeenCalledOnce();
    expect(page.message()).toBe('Storage unavailable');
    fixture.destroy();
  });
});
