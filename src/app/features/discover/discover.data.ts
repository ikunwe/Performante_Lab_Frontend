export interface ShowcaseBuild {
  id: number;
  title: string;
  author: string;
  car: string;
  category: string;
  image: string;
  budget: number;
  parts: string[];
}
export const showcaseBuilds: ShowcaseBuild[] = [
  {
    id: 1,
    title: 'Rosso. Refined.',
    author: 'rosso.studio',
    car: 'Ferrari F8 Tributo',
    category: 'Street',
    image: 'assets/car_pic.png',
    budget: 185000,
    parts: ['ล้อ forged 20 นิ้ว', 'สปอยเลอร์คาร์บอน', 'ชุดสปริงโหลด'],
  },
  {
    id: 2,
    title: 'After dark.',
    author: 'nightshift',
    car: 'Lamborghini Revuelto',
    category: 'Show',
    image: 'assets/car_pic_loginpage.jpg',
    budget: 245000,
    parts: ['ชุดแต่งคาร์บอน', 'ล้อ forged 21 นิ้ว'],
  },
  {
    id: 3,
    title: 'The weekend spec.',
    author: 'weekend.driver',
    car: 'Ferrari F8 Tributo',
    category: 'Street',
    image: 'assets/car_pic.png',
    budget: 92000,
    parts: ['ล้อ 20 นิ้ว', 'ยางสปอร์ต'],
  },
  {
    id: 4,
    title: 'Built for the apex.',
    author: 'apex.lab',
    car: 'Ferrari F8 Tributo',
    category: 'Track',
    image: 'assets/car_pic.png',
    budget: 320000,
    parts: ['เบรกสมรรถนะสูง', 'ช่วงล่างปรับระดับ', 'ยางสำหรับสนาม'],
  },
  {
    id: 5,
    title: 'Redline vision.',
    author: 'redline',
    car: 'Lamborghini Revuelto',
    category: 'Show',
    image: 'assets/car_pic_loginpage.jpg',
    budget: 275000,
    parts: ['ชุดแต่งภายนอก', 'ล้อ forged'],
  },
  {
    id: 6,
    title: 'Less, but better.',
    author: 'minimal.garage',
    car: 'Ferrari F8 Tributo',
    category: 'Street',
    image: 'assets/car_pic.png',
    budget: 68000,
    parts: ['ล้อ 20 นิ้ว'],
  },
  {
    id: 7,
    title: 'Sunday circuit.',
    author: 'circuit.club',
    car: 'Ferrari F8 Tributo',
    category: 'Track',
    image: 'assets/car_pic.png',
    budget: 198000,
    parts: ['ยางสำหรับสนาม', 'ชุดเบรก'],
  },
  {
    id: 8,
    title: 'A little louder.',
    author: 'form.and.function',
    car: 'Lamborghini Revuelto',
    category: 'Show',
    image: 'assets/car_pic_loginpage.jpg',
    budget: 165000,
    parts: ['ชุดแต่งคาร์บอน', 'สปอยเลอร์'],
  },
];
