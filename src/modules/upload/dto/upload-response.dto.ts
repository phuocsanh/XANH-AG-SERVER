export class UploadResponseDto {
  id!: string;
  public_id!: string;
  url!: string;
  name!: string;
  type!: string;
  size!: number;
  created_at!: Date;
  updated_at!: Date;
}

export class DeleteFileDto {
  public_id!: string;
}

export class MarkFileUsedDto {
  public_id!: string;
}
