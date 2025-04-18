import { Blog } from '@prisma/client';

export interface MenuCategoryWithRelations {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  parent_id?: number | null;
  status: string;
  category_id: bigint;
  type: string;
  foodMenus: {
    id: number;
    name: string;
  }[];
  beverageMenus: {
    id: number;
    name: string;
  }[];
}

export interface BlogCategoryWithRelations {
  id: number;
  name: string;
  description?: string | null;
  slug: string;
  blogs: Blog[];
}

export interface FormattedMenuCategory
  extends Omit<MenuCategoryWithRelations, 'category_id'> {
  category_id: string;
  foodMenus: any[];
  beverageMenus: any[];
}
