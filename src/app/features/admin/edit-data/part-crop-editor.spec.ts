import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PartCropEditor } from './part-crop-editor';
import { PartMaskUpload } from './part-mask-upload';
import { CROP_EDITOR_IMAGES } from './part-crop-image';
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
