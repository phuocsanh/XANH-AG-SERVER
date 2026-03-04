import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { SearchNewsDto } from './dto/search-news.dto';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('news:manage')
  create(@Body() createNewsDto: CreateNewsDto) {
    return this.newsService.create(createNewsDto);
  }

  @Get()
  findAll() {
    return this.newsService.findAll();
  }

  @Post('search')
  search(@Body() searchDto: SearchNewsDto) {
    return this.newsService.search(searchDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(+id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const news = await this.newsService.findBySlug(slug);
    if (!news) {
      throw new HttpException('Bài viết không tồn tại', HttpStatus.NOT_FOUND);
    }
    // Tăng lượt xem khi xem chi tiết qua slug (public view)
    await this.newsService.incrementViews(news.id);
    return news;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('news:manage')
  update(@Param('id') id: string, @Body() updateNewsDto: UpdateNewsDto) {
    return this.newsService.update(+id, updateNewsDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('news:manage')
  remove(@Param('id') id: string) {
    return this.newsService.softDelete(+id);
  }
}
