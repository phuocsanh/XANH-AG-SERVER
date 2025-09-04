export class UploadResponseDto {
  id!: string;
  publicId!: string;
  fileUrl!: string;
  fileName!: string;
  fileType!: string;
  fileSize!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class DeleteFileDto {
  publicId!: string;
}

export class MarkFileUsedDto {
  publicId!: string;
}