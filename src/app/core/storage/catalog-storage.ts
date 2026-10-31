import type { SupabaseClient } from '@supabase/supabase-js';

export interface StorageBrandItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
}

export interface StorageModelItem {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  imageUrl: string;
}

export interface StorageWorkshopItem {
  name: string;
  logoUrl: string;
}

export interface StoragePartItem {
  name: string;
  displayName: string;
  imageUrl: string;
  ext: string;
}

export class CatalogStorageHelper {
  static readonly BUCKET = 'catalog';

  private static cleanExt(ext: string): string {
    return ext.replace(/^\.+/, '');
  }

  /**
   * ดึงนามสกุลไฟล์จาก File Object
   */
  static getFileExtension(file: File): string {
    const parts = file.name.split('.');
    if (parts.length <= 1) return 'png';
    const ext = parts.pop()?.toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext || 'png';
  }

  /**
   * สร้าง Path โลโก้แบรนด์: {brand}/logo.{ext}
   */
  static getBrandLogoPath(brand: string, ext = 'png'): string {
    return `${this.sanitize(brand)}/logo.${this.cleanExt(ext)}`;
  }

  /**
   * สร้าง Path รูปรถต้นแบบ: {brand}/{model}/CarPicture.{ext}
   */
  static getCarPicturePath(brand: string, model: string, ext = 'jpg'): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/CarPicture.${this.cleanExt(ext)}`;
  }

  /**
   * สร้าง Path ชุดแต่ง BodyKit: {brand}/{model}/BodyKit/{bodyKitBrand}/{type}.{ext}
   */
  static getBodyKitPath(
    brand: string,
    model: string,
    bodyKitBrand: string,
    typeName: string,
    ext = 'png',
  ): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/BodyKit/${this.sanitize(bodyKitBrand)}/${this.sanitize(typeName)}.${this.cleanExt(ext)}`;
  }

  /**
   * สร้าง Path ชิ้นส่วนพาร์ตแต่ง: {brand}/{model}/Part/{partBrand}/{type}.{ext}
   */
  static getPartPath(
    brand: string,
    model: string,
    partBrand: string,
    typeName: string,
    ext = 'png',
  ): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/Part/${this.sanitize(partBrand)}/${this.sanitize(typeName)}.${this.cleanExt(ext)}`;
  }

  /**
   * สร้าง Path โลโก้แบรนด์ของแต่ง (Tuning Brand):
   * {brand}/{model}/BodyKit/{bodyKitBrand}/logo.{ext} หรือ {brand}/{model}/Part/{partBrand}/logo.{ext}
   */
  static getTuningBrandLogoPath(
    brand: string,
    model: string,
    tab: 'bodykit' | 'parts' | 'BodyKit' | 'Part',
    tuningBrand: string,
    ext = 'png',
  ): string {
    const folder = tab.toLowerCase() === 'bodykit' ? 'BodyKit' : 'Part';
    return `${this.sanitize(brand)}/${this.sanitize(model)}/${folder}/${this.sanitize(tuningBrand)}/logo.${this.cleanExt(ext)}`;
  }

  /**
   * Helper สำหรับแปลงชื่อให้อยู่ในรูปแบบที่ปลอดภัยสำหรับ Storage Path
   */
  static sanitize(text: string): string {
    return text.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-\.]/g, '');
  }

  /**
   * ดึง Public URL ของไฟล์ใน catalog bucket
   */
  static getPublicUrl(client: SupabaseClient, path: string): string {
    const { data } = client.storage.from(this.BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * อัปโหลดไฟล์ขึ้น Supabase Storage และคืนค่า Public URL
   */
  static async uploadFile(
    client: SupabaseClient,
    path: string,
    file: File | Blob,
    upsert = true,
  ): Promise<{ ok: boolean; url?: string; error?: string }> {
    try {
      const { error } = await client.storage
        .from(this.BUCKET)
        .upload(path, file, {
          upsert,
          contentType: file.type || undefined,
          cacheControl: '3600',
        });

      if (error) throw error;

      const { data: publicData } = client.storage.from(this.BUCKET).getPublicUrl(path);
      return { ok: true, url: publicData.publicUrl };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Upload failed' };
    }
  }

  /**
   * ดึงรายชื่อแบรนด์ทั้งหมดจาก Root ของ Storage bucket 'catalog'
   */
  static async listBrands(client: SupabaseClient): Promise<StorageBrandItem[]> {
    try {
      const storage = client?.storage?.from ? client.storage.from(this.BUCKET) : null;
      if (!storage || typeof storage.list !== 'function') return [];
      const { data, error } = await storage.list('', { limit: 100 });
      if (error || !data) return [];

      const folders = data.filter(
        (item) =>
          !item.name.startsWith('.') &&
          (item.id === null || item.metadata === null || !item.name.includes('.')),
      );

      const items = await Promise.all(
        folders.map(async (folder) => {
          const brandName = folder.name;
          let logoUrl = this.getPublicUrl(client, `${brandName}/logo.png`);
          try {
            const { data: files } = await storage.list(brandName, { limit: 50 });
            const logoFile = files?.find((f) =>
              /^logo\.(png|svg|jpe?g|webp)$/i.test(f.name),
            );
            if (logoFile) {
              logoUrl = this.getPublicUrl(client, `${brandName}/${logoFile.name}`);
            }
          } catch {
            // fallback to default
          }

          return {
            id: brandName,
            name: brandName,
            slug: brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            logoUrl,
          };
        }),
      );

      return items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.warn('[CatalogStorageHelper] listBrands error:', err);
      return [];
    }
  }

  /**
   * ดึงรายชื่อรุ่นรถยนต์ทั้งหมดใน {brand} (กรอง logo.* ออก)
   */
  static async listModels(client: SupabaseClient, brand: string): Promise<StorageModelItem[]> {
    try {
      const storage = client?.storage?.from ? client.storage.from(this.BUCKET) : null;
      if (!storage || typeof storage.list !== 'function') return [];
      const safeBrand = this.sanitize(brand);
      const { data, error } = await storage.list(safeBrand, { limit: 100 });
      if (error || !data) return [];

      const modelFolders = data.filter(
        (item) =>
          !item.name.startsWith('.') &&
          !/^logo\./i.test(item.name) &&
          (item.id === null || item.metadata === null || !item.name.includes('.')),
      );

      const items = await Promise.all(
        modelFolders.map(async (m) => {
          const modelName = m.name;
          let imageUrl = this.getPublicUrl(client, `${safeBrand}/${modelName}/CarPicture.jpg`);
          try {
            const { data: files } = await storage.list(`${safeBrand}/${modelName}`, { limit: 20 });
            const picFile = files?.find((f) =>
              /^CarPicture\.(jpe?g|png|webp)$/i.test(f.name),
            );
            if (picFile) {
              imageUrl = this.getPublicUrl(client, `${safeBrand}/${modelName}/${picFile.name}`);
            }
          } catch {
            // fallback
          }

          return {
            id: `${safeBrand}-${modelName}`,
            brandId: brand,
            name: modelName,
            slug: modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            imageUrl,
          };
        }),
      );

      return items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.warn('[CatalogStorageHelper] listModels error:', err);
      return [];
    }
  }

  /**
   * ดึงรายชื่อสำนักแต่ง/ยี่ห้อพาร์ตใน {brand}/{model}/{BodyKit|Part}
   */
  static async listWorkshops(
    client: SupabaseClient,
    brand: string,
    model: string,
    type: 'BodyKit' | 'Part',
  ): Promise<StorageWorkshopItem[]> {
    try {
      const storage = client?.storage?.from ? client.storage.from(this.BUCKET) : null;
      if (!storage || typeof storage.list !== 'function') return [];
      const path = `${this.sanitize(brand)}/${this.sanitize(model)}/${type}`;
      const { data, error } = await storage.list(path, { limit: 100 });
      if (error || !data) return [];

      const workshopFolders = data.filter(
        (item) =>
          !item.name.startsWith('.') &&
          (item.id === null || item.metadata === null || !item.name.includes('.')),
      );

      const items = await Promise.all(
        workshopFolders.map(async (w) => {
          const workshopName = w.name;
          let logoUrl = this.getPublicUrl(client, `${path}/${workshopName}/logo.png`);
          try {
            const { data: files } = await storage.list(`${path}/${workshopName}`, { limit: 20 });
            const logoFile = files?.find((f) =>
              /^logo\.(png|svg|jpe?g|webp)$/i.test(f.name),
            );
            if (logoFile) {
              logoUrl = this.getPublicUrl(client, `${path}/${workshopName}/${logoFile.name}`);
            }
          } catch {
            // fallback
          }

          return {
            name: workshopName,
            logoUrl,
          };
        }),
      );

      return items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.warn('[CatalogStorageHelper] listWorkshops error:', err);
      return [];
    }
  }

  /**
   * ดึงรายการชิ้นส่วนพาร์ต/ชุดแต่งใน {brand}/{model}/{BodyKit|Part}/{workshop} (กรอง logo.* ออก)
   */
  static async listItems(
    client: SupabaseClient,
    brand: string,
    model: string,
    type: 'BodyKit' | 'Part',
    workshop: string,
  ): Promise<StoragePartItem[]> {
    try {
      const storage = client?.storage?.from ? client.storage.from(this.BUCKET) : null;
      if (!storage || typeof storage.list !== 'function') return [];
      const path = `${this.sanitize(brand)}/${this.sanitize(model)}/${type}/${this.sanitize(workshop)}`;
      const { data, error } = await storage.list(path, { limit: 100 });
      if (error || !data) return [];

      const imageFiles = data.filter(
        (f) =>
          !f.name.startsWith('.') &&
          !/^logo\./i.test(f.name) &&
          /\.(png|jpe?g|webp|svg)$/i.test(f.name),
      );

      return imageFiles.map((f) => {
        const parts = f.name.split('.');
        const ext = parts.pop() || 'png';
        const rawName = parts.join('.');
        const displayName = rawName.replace(/[-_]+/g, ' ');
        const imageUrl = this.getPublicUrl(client, `${path}/${f.name}`);
        return {
          name: rawName,
          displayName,
          imageUrl,
          ext,
        };
      });
    } catch (err) {
      console.warn('[CatalogStorageHelper] listItems error:', err);
      return [];
    }
  }
}

