export class UploadResponseDto {
  id!: string;
  publicId!: string;
  url!: string;
  name!: string;
  type!: string;
  size!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class DeleteFileDto {
  publicId!: string;
}

export class MarkFileUsedDto {
  publicId!: string;
}
