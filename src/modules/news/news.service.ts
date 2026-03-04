import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { News } from '../../entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { SearchNewsDto } from './dto/search-news.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { QueryHelper } from '../../common/helpers/query-helper';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News)
    private newsRepository: Repository<News>,
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
      
      return await this.newsRepository.save(news);
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
      order: { created_at: 'DESC' },
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
      await this.newsRepository.update(id, updateNewsDto);
      return this.findOne(id);
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
