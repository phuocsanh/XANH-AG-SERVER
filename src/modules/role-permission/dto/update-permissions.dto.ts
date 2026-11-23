import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

/** Tập permission code đầy đủ mong muốn sau khi lưu. */
export class UpdatePermissionsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes!: string[];
}
