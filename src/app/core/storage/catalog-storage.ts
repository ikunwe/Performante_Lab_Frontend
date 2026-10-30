import type { SupabaseClient } from '@supabase/supabase-js';

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
      const { data, error } = await client.storage
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
}

