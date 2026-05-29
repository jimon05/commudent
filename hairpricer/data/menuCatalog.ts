import type { ServiceCategory } from "@/types/shop";

export type MenuCategory = {
  value: ServiceCategory;
  label: string;
  menus: string[];
};

export const menuCatalog: MenuCategory[] = [
  {
    value: "cut",
    label: "커트",
    menus: ["여성 디자인컷", "남성 디자인컷", "앞머리컷"]
  },
  {
    value: "perm",
    label: "펌",
    menus: ["일반펌", "셋팅펌", "디지털펌", "볼륨매직", "매직셋팅", "매직", "다운펌", "아이롱펌", "열펌"]
  },
  {
    value: "color",
    label: "염색",
    menus: ["전체염색", "뿌리염색", "탈색"]
  },
  {
    value: "clinic",
    label: "클리닉",
    menus: ["기본 클리닉", "복구 클리닉"]
  },
  {
    value: "styling",
    label: "스타일링",
    menus: ["드라이/스타일링"]
  }
];

export function getMenusByCategory(category: ServiceCategory): string[] {
  return menuCatalog.find((item) => item.value === category)?.menus ?? [];
}

export function getCategoryLabel(category: ServiceCategory): string {
  return menuCatalog.find((item) => item.value === category)?.label ?? category;
}
