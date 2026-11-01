import { storageCatalogData } from '../../core/catalog/storage-catalog';
export type CatalogViews = Partial<
  Record<'front45' | 'front' | 'side' | 'rear45' | 'rear', string>
>;
export interface CatalogCar {
  views?: CatalogViews;
  id: string;
  storagePath?: string;
  modelName?: string;
  brand: string;
  name: string;
  image: string;
  body: string;
  reference?: {
    brandId: string;
    modelId: string;
    generationId: string | null;
    modelName: string;
    generationName: string | null;
    chassisCodes: string[];
    yearStart: number | null;
    yearEnd: number | null;
    sourceUrl: string;
  };
}
export interface PartCategory {
  id: string;
  name: string;
  label: string;
  icon: string;
}
export interface CatalogPart {
  /** Full photo aligned to the default frame by the Admin mask editor. */
  layerViews?: CatalogViews;
  /** Alpha PNG: opaque only in the region replaced by this part. */
  masks?: CatalogViews;
  views?: CatalogViews;
  storagePath?: string;
  manufacturerLogo?: string | null;
  previewImage?: string;
  description: string;
  id: string;
  carId: string;
  category: string;
  name: string;
  finish: string;
  crop: 'full' | 'front' | 'rear';
}
export const partCategories: PartCategory[] = [
  { id: 'bodykits', name: 'Full Body Kits', label: 'ชุดแต่งรอบคัน', icon: 'car' },
  { id: 'front', name: 'Front Bumpers', label: 'กันชนหน้า', icon: 'front' },
  { id: 'rear', name: 'Rear Bumpers', label: 'กันชนหลัง', icon: 'rear' },
  { id: 'wheels', name: 'Wheels', label: 'ล้อ', icon: 'wheel' },
  { id: 'brakes', name: 'Brakes', label: 'ระบบเบรก', icon: 'parts' },
  { id: 'exhaust', name: 'Exhaust', label: 'ท่อไอเสีย', icon: 'parts' },
  { id: 'suspension', name: 'Suspension', label: 'ช่วงล่าง', icon: 'parts' },
  { id: 'others', name: 'Other Parts', label: 'พาร์ทอื่น ๆ', icon: 'parts' },
  { id: 'spoilers', name: 'Spoilers', label: 'สปอยเลอร์', icon: 'parts' },
];


/** Categories supported by both the builder and part comparison. */
export const buildPartCategories: PartCategory[] = [
  { id: 'bodykits', name: 'Full Body Kits', label: 'ชุดแต่งรอบคัน', icon: 'car' },
  { id: 'front', name: 'Front Bumper', label: 'กันชนหน้า', icon: 'front' },
  { id: 'rear', name: 'Rear Bumper', label: 'กันชนหลัง', icon: 'rear' },
  { id: 'wheels', name: 'Wheels', label: 'ล้อ', icon: 'wheel' },
  { id: 'spoilers', name: 'Spoilers', label: 'สปอยเลอร์', icon: 'parts' },
];

export const catalogCars = () => storageCatalogData().cars;
export const catalogParts = () => storageCatalogData().parts;
export const catalogBrandLogos = () =>
  Object.fromEntries(storageCatalogData().brands.map((b) => [b.name, b.logoUrl || '']));
