import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { News } from '../../entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { SearchNewsDto } from './dto/search-news.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { QueryHelper } from '../../common/helpers/query-helper';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News)
    private newsRepository: Repository<News>,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo bài viết mới
   */
  async create(createNewsDto: CreateNewsDto): Promise<News> {
    try {
      const news = this.newsRepository.create(createNewsDto);
      
      if (!news.slug) {
        news.slug = this.generateSlug(news.title);
      }
      
      const savedNews = await this.newsRepository.save(news);

      // Đánh dấu ảnh là đã sử dụng
      await this.markImagesAsUsed(savedNews);

      return savedNews;
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'bài viết');
    }
  }

  /**
   * Lấy tất cả bài viết
   */
  async findAll(): Promise<News[]> {
    return this.newsRepository.find({
      where: { deleted_at: IsNull() },
      order: { is_pinned: 'DESC', created_at: 'DESC' },
    });
  }

  /**
   * Tìm bài viết theo ID
   */
  async findOne(id: number): Promise<News | null> {
    return this.newsRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });
  }

  /**
   * Tìm bài viết theo Slug
   */
  async findBySlug(slug: string): Promise<News | null> {
    return this.newsRepository.findOne({
      where: { slug, deleted_at: IsNull() },
    });
  }

  /**
   * Cập nhật bài viết
   */
  async update(id: number, updateNewsDto: UpdateNewsDto): Promise<News | null> {
    try {
      const currentNews = await this.findOne(id);
      if (!currentNews) return null;

      await this.newsRepository.update(id, updateNewsDto);
      const updatedNews = await this.findOne(id);

      if (updatedNews) {
        // Dọn dẹp ảnh cũ và đánh dấu ảnh mới
        await this.handleImageUpdate(currentNews, updatedNews);
      }

      return updatedNews;
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'bài viết');
    }
  }

  /**
   * Xóa mềm bài viết
   */
  async softDelete(id: number): Promise<void> {
    await this.newsRepository.softDelete(id);
  }

  /**
   * Xóa vĩnh viễn bài viết và các file liên quan
   */
  async remove(id: number): Promise<void> {
    const news = await this.findOne(id);
    if (!news) return;

    // 1. Dọn dẹp tất cả tham chiếu file, giảm reference count
    // Nếu count về 0, FileTrackingService sẽ tự đánh dấu là 'is_orphaned'
    await this.fileTrackingService.batchRemoveEntityFileReferences('News', id);

    // 2. Xóa bản ghi bài viết
    await this.newsRepository.delete(id);
  }

  /**
   * Tìm kiếm bài viết
   */
  async search(searchDto: SearchNewsDto) {
    const queryBuilder = this.newsRepository.createQueryBuilder('news');
    queryBuilder.where('news.deleted_at IS NULL');

    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'news',
      ['title', 'category']
    );

    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'news',
      ['filters', 'nested_filters', 'operator']
    );

    queryBuilder.addOrderBy('news.is_pinned', 'DESC');
    queryBuilder.addOrderBy('news.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Tăng lượt xem
   */
  async incrementViews(id: number): Promise<void> {
    await this.newsRepository.increment({ id }, 'views', 1);
  }

  /**
   * Đánh dấu các ảnh trong bài viết là đã được sử dụng
   */
  private async markImagesAsUsed(news: News): Promise<void> {
    // 1. Ảnh đại diện
    if (news.thumbnail_url) {
      const file = await this.fileTrackingService.findByFileUrl(news.thumbnail_url);
      if (file) {
        await this.fileTrackingService.createFileReference(file, 'News', news.id, 'thumbnail_url');
        await this.fileTrackingService.incrementReferenceCount(file.id);
      }
    }

    // 2. Bộ sưu tập ảnh
    if (news.images && news.images.length > 0) {
      for (const url of news.images) {
        const file = await this.fileTrackingService.findByFileUrl(url);
        if (file) {
          await this.fileTrackingService.createFileReference(file, 'News', news.id, 'gallery');
          await this.fileTrackingService.incrementReferenceCount(file.id);
        }
      }
    }
  }

  /**
   * Xử lý dọn dẹp ảnh khi cập nhật bài viết
   */
  private async handleImageUpdate(oldNews: News, newNews: News): Promise<void> {
    // 1. Xử lý ảnh đại diện
    if (oldNews.thumbnail_url !== newNews.thumbnail_url) {
      if (oldNews.thumbnail_url) {
        // Chỉ xóa tham chiếu và giảm count, không gọi ImageCleanupHelper.deleteImage ngay
        await this.fileTrackingService.removeFileReferenceByUrl(oldNews.thumbnail_url, 'News', oldNews.id);
      }
      if (newNews.thumbnail_url) {
        const file = await this.fileTrackingService.findByFileUrl(newNews.thumbnail_url);
        if (file) {
          await this.fileTrackingService.createFileReference(file, 'News', newNews.id, 'thumbnail_url');
          await this.fileTrackingService.incrementReferenceCount(file.id);
        }
      }
    }

    // 2. Xử lý bộ sưu tập ảnh (Images array)
    const oldImages = oldNews.images || [];
    const newImages = newNews.images || [];
    
    // Tìm các ảnh bị xóa khỏi bộ sưu tập
    const removedImages = oldImages.filter(url => !newImages.includes(url));
    for (const url of removedImages) {
      await this.fileTrackingService.removeFileReferenceByUrl(url, 'News', oldNews.id);
    }

    // Tìm các ảnh mới thêm vào bộ sưu tập
    const addedImages = newImages.filter(url => !oldImages.includes(url));
    for (const url of addedImages) {
      const file = await this.fileTrackingService.findByFileUrl(url);
      if (file) {
        await this.fileTrackingService.createFileReference(file, 'News', newNews.id, 'gallery');
        await this.fileTrackingService.incrementReferenceCount(file.id);
      }
    }
  }

  /**
   * Helper tạo slug đơn giản
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/([^0-9a-z-\s])/g, '')
      .replace(/(\s+)/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now();
  }
}
