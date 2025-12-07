import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator để lấy thông tin user hiện tại từ request
 * User được inject bởi JWT Guard sau khi validate token
 * 
 * Sử dụng:
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: any) {
 *   return user;
 * }
 * 
 * Hoặc lấy một field cụ thể:
 * @Post('create')
 * @UseGuards(JwtAuthGuard)
 * create(@CurrentUser('id') userId: number) {
 *   // userId sẽ là user.id
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Nếu có data (field name), trả về field đó
    // Nếu không có data, trả về toàn bộ user object
    return data ? user?.[data] : user;
  },
);
