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
   * สกัด Relative Path ภายใน Bucket 'catalog' จาก URL หรือ Path ใดๆ
   */
  static extractStoragePath(urlOrPath: string): string {
    if (!urlOrPath) return '';
    try {
      let clean = urlOrPath.split('?')[0].split('#')[0];
      const marker = '/storage/v1/object/public/catalog/';
      const idx = clean.indexOf(marker);
      if (idx !== -1) {
        clean = clean.substring(idx + marker.length);
      } else {
        const simpleMarker = '/catalog/';
        const sIdx = clean.indexOf(simpleMarker);
        if (sIdx !== -1) {
          clean = clean.substring(sIdx + simpleMarker.length);
        }
      }
      return clean.replace(/^\/+|\/+$/g, '');
    } catch {
      return urlOrPath.replace(/^\/+|\/+$/g, '');
    }
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
   * สร้าง Path รูปรถแยกตาม 4 มุมมอง: {brand}/{model}/{angle}.{ext}
   * มุมมอง: '45_front', 'front', '45_Back', 'Back'
   */
  static getCarAnglePath(brand: string, model: string, angle: string, ext = 'png'): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/${angle}.${this.cleanExt(ext)}`;
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
   * สร้าง Path ชุดแต่ง FullBodyKits แยกตามมุมมอง:
   * {brand}/{model}/BodyKit/{bodyKitBrand}/{kitName}/{angle}.{ext}
   */
  static getBodyKitAnglePath(
    brand: string,
    model: string,
    bodyKitBrand: string,
    kitName: string,
    angle: string,
    ext = 'png',
  ): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/BodyKit/${this.sanitize(bodyKitBrand)}/${this.sanitize(kitName)}/${angle}.${this.cleanExt(ext)}`;
  }

  /**
   * สร้าง Path ชิ้นส่วนพาร์ตแต่งแยกตามหมวดหมู่และมุมมอง:
   * {brand}/{model}/Part/{category}/{partBrand}/{partName}/{angle}.{ext}
   */
  static getPartAnglePath(
    brand: string,
    model: string,
    category: string,
    partBrand: string,
    partName: string,
    angle: string,
    ext = 'png',
  ): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/Part/${this.sanitize(category)}/${this.sanitize(partBrand)}/${this.sanitize(partName)}/${angle}.${this.cleanExt(ext)}`;
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
          cacheControl: '0',
        });

      if (error) throw error;

      const { data: publicData } = client.storage.from(this.BUCKET).getPublicUrl(path);
      return { ok: true, url: publicData.publicUrl };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Upload failed' };
    }
  }

  /**
   * ลบไฟล์มุมมอง/ชื่อเดียวกันที่มีนามสกุลอื่น (เช่น .png, .jpg, .jpeg, .webp) ในโฟลเดอร์เดียวกัน
   * ป้องกันการเกิดไฟล์ซ้ำซ้อน 2 รูปในมุมเดียวกันเมื่อผู้ใช้อัปโหลดรูปใหม่ที่มีนามสกุลต่างจากรูปเดิม
   */
  static async removeSiblingFiles(
    client: SupabaseClient,
    folderPath: string,
    baseName: string,
    keepExt: string,
  ): Promise<void> {
    try {
      const storage = client?.storage?.from ? client.storage.from(this.BUCKET) : null;
      if (!storage || typeof storage.list !== 'function' || typeof storage.remove !== 'function') {
        return;
      }
      const cleanFolder = this.extractStoragePath(folderPath);
      const safeKeepExt = this.cleanExt(keepExt).toLowerCase();
      const baseLower = baseName.toLowerCase();

      // ดึงรายชื่อไฟล์ในโฟลเดอร์เพื่อเช็คว่ามีไฟล์เดิมที่เป็นชื่อมุมมองเดียวกันแต่นามสกุลต่างกันหรือไม่
      const { data: files, error } = await storage.list(cleanFolder, { limit: 100 });
      if (error || !files) {
        // Fallback: ลบนามสกุลที่อาจซ้ำซ้อนโดยตรง
        const candidateExts = ['png', 'jpg', 'jpeg', 'webp'].filter((e) => e !== safeKeepExt);
        const paths = candidateExts.map((e) =>
          cleanFolder ? `${cleanFolder}/${baseName}.${e}` : `${baseName}.${e}`,
        );
        if (baseLower === '45_front') {
          for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
            paths.push(cleanFolder ? `${cleanFolder}/CarPicture.${ext}` : `CarPicture.${ext}`);
          }
        }
        await storage.remove(paths);
        return;
      }

      const filesToDelete: string[] = [];

      for (const f of files) {
        if (!f.name || f.name.startsWith('.')) continue;
        const dotIdx = f.name.lastIndexOf('.');
        if (dotIdx === -1) continue;

        const fBase = f.name.substring(0, dotIdx).toLowerCase();
        const fExt = f.name.substring(dotIdx + 1).toLowerCase();

        // ตรวจสอบว่าเป็นชื่อมุมมองเดียวกัน หรือเป็น CarPicture เดิม (กรณี 45_front)
        const isTargetBase = fBase === baseLower;
        const isLegacyCarPicture = baseLower === '45_front' && fBase === 'carpicture';

        if ((isTargetBase && fExt !== safeKeepExt) || isLegacyCarPicture) {
          filesToDelete.push(cleanFolder ? `${cleanFolder}/${f.name}` : f.name);
        }
      }

      if (filesToDelete.length > 0) {
        await storage.remove(filesToDelete);
      }
    } catch (err) {
      console.warn('[CatalogStorageHelper] removeSiblingFiles warning:', err);
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
          let imageUrl = this.getPublicUrl(client, `${safeBrand}/${modelName}/45_front.png`);
          try {
            const { data: files } = await storage.list(`${safeBrand}/${modelName}`, { limit: 20 });
            const picFile =
              files?.find((f) => /^45_front\.(png|jpe?g|webp)$/i.test(f.name)) ||
              files?.find((f) => /^CarPicture\.(jpe?g|png|webp)$/i.test(f.name));
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

      const result: StoragePartItem[] = [];

      for (const f of data) {
        if (f.name.startsWith('.') || /^logo\./i.test(f.name)) continue;

        // ถ้าเป็นไฟล์รูปภาพโดยตรง
        if (/\.(png|jpe?g|webp|svg)$/i.test(f.name)) {
          const parts = f.name.split('.');
          const ext = parts.pop() || 'png';
          const rawName = parts.join('.');
          const displayName = rawName.replace(/[-_]+/g, ' ');
          const imageUrl = this.getPublicUrl(client, `${path}/${f.name}`);
          result.push({
            name: rawName,
            displayName,
            imageUrl,
            ext,
          });
        } else if (!f.name.includes('.')) {
          // ถ้าเป็นโฟลเดอร์ของชุดแต่ง/ชิ้นส่วน (Multi-Angle Folder)
          try {
            const { data: subFiles } = await storage.list(`${path}/${f.name}`, { limit: 20 });
            if (subFiles && subFiles.length > 0) {
              const primaryFile =
                subFiles.find((s) => /^45_front\./i.test(s.name)) ||
                subFiles.find((s) => /^front\./i.test(s.name)) ||
                subFiles.find((s) => /^45_Back\./i.test(s.name)) ||
                subFiles.find((s) => /^Back\./i.test(s.name)) ||
                subFiles.find((s) => /\.(png|jpe?g|webp)$/i.test(s.name));
              if (primaryFile) {
                const parts = primaryFile.name.split('.');
                const ext = parts.pop() || 'png';
                result.push({
                  name: f.name,
                  displayName: f.name.replace(/[-_]+/g, ' '),
                  imageUrl: this.getPublicUrl(client, `${path}/${f.name}/${primaryFile.name}`),
                  ext,
                });
              }
            }
          } catch {
            // ignore subfolder list error
          }
        }
      }

      return result;
    } catch (err) {
      console.warn('[CatalogStorageHelper] listItems error:', err);
      return [];
    }
  }

  /**
   * ลบไฟล์ออกจาก Storage bucket 'catalog'
   */
  static async deleteFile(
    client: SupabaseClient,
    pathOrUrl: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const storage = client?.storage?.from ? client.storage.from(this.BUCKET) : null;
      if (!storage || typeof storage.remove !== 'function') {
        return { ok: false, error: 'Storage not available' };
      }
      const path = this.extractStoragePath(pathOrUrl);
      if (!path) return { ok: true };
      const { error } = await storage.remove([path]);
      if (error) throw error;
      return { ok: true };
    } catch (err: any) {
      console.warn('[CatalogStorageHelper] deleteFile error:', err);
      return { ok: false, error: err?.message || 'Delete failed' };
    }
  }

  /**
   * ลบไฟล์ทั้งหมดในโฟลเดอร์ prefix ออกจาก Storage bucket 'catalog' แบบ Recursive (ครอบคลุมโฟลเดอร์ย่อยทุกระดับ)
   */
  static async deleteFolderRecursively(
    client: SupabaseClient,
    prefixOrUrl: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const storage = client?.storage?.from ? client.storage.from(this.BUCKET) : null;
      if (!storage || typeof storage.list !== 'function' || typeof storage.remove !== 'function') {
        return { ok: false, error: 'Storage not available' };
      }

      const rootPrefix = this.extractStoragePath(prefixOrUrl);
      if (!rootPrefix) return { ok: true };

      const filesToDelete: string[] = [];

      const scanDir = async (dirPath: string) => {
        try {
          const { data, error } = await storage.list(dirPath, { limit: 100 });
          if (error || !data) return;

          for (const item of data) {
            if (!item.name || item.name.startsWith('.')) continue;
            const fullItemPath = dirPath ? `${dirPath}/${item.name}` : item.name;
            const isSubfolder = item.id === null || item.metadata === null || !item.name.includes('.');
            if (isSubfolder) {
              await scanDir(fullItemPath);
            } else {
              filesToDelete.push(fullItemPath);
            }
          }
        } catch (subErr) {
          console.warn('[CatalogStorageHelper] scanDir warning:', subErr);
        }
      };

      await scanDir(rootPrefix);

      // ถ้าไม่พบไฟล์ใน subfolder อาจเป็นเพราะ prefix เป็นไฟล์อยู่แล้ว
      if (filesToDelete.length === 0) {
        await storage.remove([rootPrefix]);
      } else {
        // ลบไฟล์ทีละ batch ละไม่เกิน 50 ไฟล์
        for (let i = 0; i < filesToDelete.length; i += 50) {
          const batch = filesToDelete.slice(i, i + 50);
          await storage.remove(batch);
        }
      }

      return { ok: true };
    } catch (err: any) {
      console.warn('[CatalogStorageHelper] deleteFolderRecursively error:', err);
      return { ok: false, error: err?.message || 'Delete folder failed' };
    }
  }

  /**
   * ลบไฟล์ทั้งหมดในโฟลเดอร์ prefix (alias ไปยัง deleteFolderRecursively)
   */
  static async deleteFolder(
    client: SupabaseClient,
    prefix: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.deleteFolderRecursively(client, prefix);
  }
}
