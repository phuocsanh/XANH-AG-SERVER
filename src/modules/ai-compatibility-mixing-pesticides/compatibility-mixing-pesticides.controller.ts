import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { AskDto } from './dto/ask.dto';
import { CompatibilityMixingPesticidesService } from './compatibility-mixing-pesticides.service';

@Controller('compatibility-mixing-pesticides')
export class CompatibilityMixingPesticidesController {
  private readonly logger = new Logger(
    CompatibilityMixingPesticidesController.name,
  );

  constructor(
    private readonly CompatibilityMixingPesticidesService: CompatibilityMixingPesticidesService,
  ) {}

  @Post('ask')
  @UsePipes(new ValidationPipe({ transform: true }))
  async askQuestion(@Body() askDto: AskDto) {
    const { question } = askDto;

    if (!question || question.trim().length === 0) {
      throw new HttpException(
        {
          success: false,
          error: 'Vui lòng cung cấp câu hỏi.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log(`Processing question: ${question}`);
      const answer =
        await this.CompatibilityMixingPesticidesService.getDocumentAnswer(
          question,
        );
      this.logger.log(`Generated answer length: ${answer.length}`);

      const response = {
        success: true,
        answer: answer,
      };

      this.logger.log(`Sending response with status 201`);
      return response;
    } catch (error: any) {
      this.logger.error('Error in askQuestion:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Lỗi xử lý AI từ server.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
