import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { FileTrackingService } from './file-tracking.service';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';

@Controller('file-tracking')
export class FileTrackingController {
  constructor(private readonly fileTrackingService: FileTrackingService) {}

  @Post()
  create(@Body() createFileUploadDto: CreateFileUploadDto) {
    return this.fileTrackingService.create(createFileUploadDto);
  }

  @Get()
  findAll() {
    return this.fileTrackingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileTrackingService.findOne(+id);
  }

  @Get('public/:publicId')
  findByPublicId(@Param('publicId') publicId: string) {
    return this.fileTrackingService.findByPublicId(publicId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: Partial<CreateFileUploadDto>) {
    return this.fileTrackingService.update(+id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fileTrackingService.remove(+id);
  }

  @Get('orphaned')
  findOrphanedFiles() {
    return this.fileTrackingService.findOrphanedFiles();
  }

  @Patch(':id/mark-for-deletion')
  markForDeletion(@Param('id') id: string) {
    return this.fileTrackingService.markForDeletion(+id);
  }

  @Get('marked-for-deletion')
  findFilesMarkedForDeletion() {
    return this.fileTrackingService.findFilesMarkedForDeletion();
  }
}