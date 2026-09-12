export type ServiceModule = "Laboratory" | "Radiology" | "Pharmacy" | "Other";

export interface ServicePriceItem {
  id: string;
  module: ServiceModule;
  name: string;
  category: string;
  price: number;
}

export const SERVICE_PRICING_SETTINGS_KEY = "clinicalServicePrices";

export function parseServicePrices(settings: Record<string, string>): ServicePriceItem[] {
  try {
    const parsed = JSON.parse(settings[SERVICE_PRICING_SETTINGS_KEY] || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item.id || `svc-${Date.now()}-${Math.random().toString(36).slice(2)}`),
        module: item.module as ServiceModule,
        name: String(item.name || "").trim(),
        category: String(item.category || "").trim(),
        price: Number(item.price) || 0,
      }))
      .filter((item) => item.name && item.category && item.price >= 0);
  } catch {
    return [];
  }
}

export function stringifyServicePrices(items: ServicePriceItem[]): string {
  return JSON.stringify(items.map((item) => ({ ...item, price: Number(item.price) || 0 })));
}

export function findServicePrice(
  items: ServicePriceItem[],
  module: ServiceModule,
  name: string,
  category?: string
): ServicePriceItem | undefined {
  const normalizedName = name.trim().toLowerCase();
  const normalizedCategory = (category || "").trim().toLowerCase();
  return items.find((item) =>
    item.module === module &&
    item.name.trim().toLowerCase() === normalizedName &&
    (!normalizedCategory || item.category.trim().toLowerCase() === normalizedCategory)
  ) || items.find((item) => item.module === module && item.name.trim().toLowerCase() === normalizedName);
}
