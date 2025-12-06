import { Logger } from '@nestjs/common';

/**
 * Helper class để xử lý việc xóa ảnh cũ không còn sử dụng
 * Cung cấp các phương thức tiện ích để trích xuất public_id từ Cloudinary URL
 * và xóa ảnh thông qua UploadService
 */
export class ImageCleanupHelper {
  private static readonly logger = new Logger(ImageCleanupHelper.name);

  /**
   * Trích xuất public_id từ Cloudinary URL
   * @param url - URL của ảnh trên Cloudinary
   * @returns public_id hoặc null nếu không phải URL Cloudinary
   */
  static extractPublicIdFromUrl(url: string): string | null {
    try {
      // URL mẫu: https://res.cloudinary.com/cloud-name/image/upload/v123456/xanh-ag/products/abc.jpg
      // Hoặc: https://res.cloudinary.com/cloud-name/image/upload/xanh-ag/products/abc.jpg

      if (!url || !url.includes('cloudinary.com')) {
        return null;
      }

      // Tách URL để lấy phần sau /upload/
      const parts = url.split('/upload/');
      if (parts.length < 2) {
        return null;
      }

      // Lấy phần sau /upload/
      let pathAfterUpload = parts[1];
      if (!pathAfterUpload) {
        return null;
      }

      // Loại bỏ version nếu có (vXXXXXX/)
      pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');

      // Loại bỏ extension (.jpg, .png, ...)
      const publicId = pathAfterUpload.replace(/\.[^.]+$/, '');

      return publicId;
    } catch (error) {
      this.logger.error(
        `Lỗi khi trích xuất public_id từ URL ${url}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Xóa một ảnh duy nhất
   * @param imageUrl - URL của ảnh cần xóa
   * @param uploadService - Instance của UploadService
   */
  static async deleteImage(
    imageUrl: string,
    uploadService: any,
  ): Promise<void> {
    try {
      const publicId = this.extractPublicIdFromUrl(imageUrl);
      if (publicId && uploadService) {
        await uploadService.deleteFile(publicId);
        this.logger.log(`Đã xóa ảnh: ${publicId}`);
      }
    } catch (error) {
      // Log lỗi nhưng không throw để không ảnh hưởng đến logic chính
      this.logger.warn(
        `Không thể xóa ảnh ${imageUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Xóa nhiều ảnh
   * @param imageUrls - Mảng URL của các ảnh cần xóa
   * @param uploadService - Instance của UploadService
   */
  static async deleteImages(
    imageUrls: string[],
    uploadService: any,
  ): Promise<void> {
    for (const imageUrl of imageUrls) {
      await this.deleteImage(imageUrl, uploadService);
    }
  }

  /**
   * So sánh 2 mảng URL và tìm ra các URL bị loại bỏ
   * @param oldUrls - Mảng URL cũ
   * @param newUrls - Mảng URL mới
   * @returns Mảng các URL bị loại bỏ
   */
  static findRemovedUrls(oldUrls: string[], newUrls: string[]): string[] {
    return oldUrls.filter((oldUrl) => !newUrls.includes(oldUrl));
  }

  /**
   * Xóa ảnh cũ khi có sự thay đổi trong mảng URL
   * @param oldUrls - Mảng URL cũ
   * @param newUrls - Mảng URL mới
   * @param uploadService - Instance của UploadService
   */
  static async cleanupArrayImages(
    oldUrls: string[] | undefined,
    newUrls: string[] | undefined,
    uploadService: any,
  ): Promise<void> {
    if (!newUrls) {
      return; // Không có update, không làm gì
    }

    const oldUrlsArray = oldUrls || [];
    const removedUrls = this.findRemovedUrls(oldUrlsArray, newUrls);

    if (removedUrls.length > 0) {
      await this.deleteImages(removedUrls, uploadService);
    }
  }

  /**
   * Xóa ảnh cũ khi có sự thay đổi trong URL đơn (ví dụ: avatar, thumb)
   * @param oldUrl - URL cũ
   * @param newUrl - URL mới
   * @param uploadService - Instance của UploadService
   */
  static async cleanupSingleImage(
    oldUrl: string | undefined,
    newUrl: string | undefined,
    uploadService: any,
  ): Promise<void> {
    if (!newUrl || !oldUrl || oldUrl === newUrl) {
      return; // Không có thay đổi
    }

    await this.deleteImage(oldUrl, uploadService);
  }
}
