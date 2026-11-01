export interface ShowcaseBuild {
  id: string;
  title: string;
  author: string;
  car: string;
  carId?: string;
  category: string;
  image: string;
  budget: number;
  parts: string[];
  likes?: number;
  isOwn: boolean;
  isPublic: boolean;
  createdAt?: string;
}
