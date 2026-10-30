export const catalogBrandLogos: Record<string, string> = {
  Ferrari: 'assets/brands/ferrari.png',
  Lamborghini: 'assets/brands/lamborghini.png',
};

export interface CatalogCar {
  id: string;
  brand: string;
  name: string;
  image: string;
  body: string;
  reference?: {
    brandId: string; modelId: string; generationId: string | null;
    modelName: string; generationName: string | null; chassisCodes: string[];
    yearStart: number | null; yearEnd: number | null; sourceUrl: string;
  };
}
export interface PartCategory {
  id: string;
  name: string;
  label: string;
  icon: string;
}
export interface CatalogPart {
  previewImage?: string;
  description: string;
  id: string;
  carId: string;
  category: string;
  name: string;
  finish: string;
  crop: 'full' | 'front' | 'rear';
}
export const catalogCars: CatalogCar[] = [
  {
    id: 'f8-tributo',
    brand: 'Ferrari',
    name: 'Ferrari F8 Tributo',
    image: 'assets/car_pic.png',
    body: 'Coupe',
  },
  {
    id: 'revuelto',
    brand: 'Lamborghini',
    name: 'Lamborghini Revuelto',
    image: 'assets/car_pic_loginpage.jpg',
    body: 'Coupe',
  },
];
export const partCategories: PartCategory[] = [
  { id: 'bodykits', name: 'Full Body Kits', label: 'ชุดแต่งรอบคัน', icon: 'car' },
  { id: 'front', name: 'Front Bumpers', label: 'กันชนหน้า', icon: 'front' },
  { id: 'rear', name: 'Rear Bumpers', label: 'กันชนหลัง', icon: 'rear' },
  { id: 'wheels', name: 'Wheels', label: 'ล้อ', icon: 'wheel' },
  { id: 'spoilers', name: 'Spoilers', label: 'สปอยเลอร์', icon: 'parts' },
];
const partDescriptions: Record<string, string> = {
  bodykits: 'แนวทางชุดแต่งภายนอกรอบคัน รวมดีไซน์ด้านหน้า ด้านข้าง และด้านหลัง',
  front: 'แนวทางดีไซน์กันชนหน้าและส่วนเสริมด้านหน้าของรถ',
  rear: 'แนวทางดีไซน์กันชนหลังและส่วนเสริมบริเวณท้ายรถ',
  wheels: 'แนวทางดีไซน์ล้อ ขนาดและระยะติดตั้งยังไม่ระบุ',
  spoilers: 'แนวทางดีไซน์สปอยเลอร์ท้าย ตำแหน่งติดตั้งยังไม่ระบุ',
};
const samples = [
  { category: 'bodykits', name: 'Street Aero Concept', finish: 'Gloss finish', crop: 'full' },
  { category: 'bodykits', name: 'Carbon Series Concept', finish: 'Carbon finish', crop: 'full' },
  { category: 'bodykits', name: 'Track Edition Concept', finish: 'Matte finish', crop: 'full' },
  { category: 'front', name: 'Sport Front Bumper', finish: 'Body color', crop: 'front' },
  { category: 'front', name: 'Aero Front Splitter', finish: 'Carbon finish', crop: 'front' },
  { category: 'rear', name: 'Sport Rear Bumper', finish: 'Body color', crop: 'rear' },
  { category: 'rear', name: 'Rear Diffuser Concept', finish: 'Carbon finish', crop: 'rear' },
  { category: 'wheels', name: 'Forged Wheel Concept', finish: 'Satin finish', crop: 'full' },
  { category: 'spoilers', name: 'Aero Wing Concept', finish: 'Carbon finish', crop: 'rear' },
] as const;
export const catalogParts: CatalogPart[] = catalogCars.flatMap((car) =>
  samples.map((part, index) => ({
    ...part,
    description: partDescriptions[part.category],
    id: car.id + '-' + index,
    carId: car.id,
  })),
);
