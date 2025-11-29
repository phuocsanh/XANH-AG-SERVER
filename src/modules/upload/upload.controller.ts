import {
  Controller,
  Post,
  Delete,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadResponseDto, MarkFileUsedDto } from './dto/upload-response.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { MAX_IMAGE_SIZE, MAX_FILE_SIZE } from '../../common/constants/app.constants';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: MAX_IMAGE_SIZE,
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.uploadService.uploadImage(file);
  }

  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.uploadService.uploadFile(file);
  }

  @Delete(':folder/:filename')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('PRODUCT_MANAGE')
  async deleteFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    const publicId = `${folder}/${filename}`;

    if (!publicId) {
      throw new BadRequestException('PublicId is required');
    }

    // Decode URL-encoded publicId
    const decodedPublicId = decodeURIComponent(publicId);

    return this.uploadService.deleteFile(decodedPublicId);
  }

  @Patch('mark-used')
  async markFileAsUsed(@Body() markFileUsedDto: MarkFileUsedDto) {
    return this.uploadService.markFileAsUsed(markFileUsedDto.public_id);
  }

  @Post('cleanup')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('PRODUCT_MANAGE')
  async cleanupUnusedFiles() {
    return this.uploadService.cleanupUnusedFiles();
  }
}
