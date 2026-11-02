export interface ShowcaseBuild {
  id: string;
  title: string;
  author: string;
  authorAvatar?: string;
  car: string;
  carId?: string;
  category: string;
  image: string;
  budget: number;
  parts: string[];
  partIds?: string[];
  partDetails?: { id: string; name: string; category: string | null }[];
  likes?: number;
  isOwn: boolean;
  isPublic: boolean;
  createdAt?: string;
}
