import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AiDocumentService } from './ai-document.service';
import { AskDto } from './dto/ask.dto';

@Controller('ai-document')
export class AiDocumentController {
  constructor(private readonly aiDocumentService: AiDocumentService) {}

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
      const answer = await this.aiDocumentService.getDocumentAnswer(question);

      return {
        success: true,
        answer: answer,
      };
    } catch (error: any) {
      console.error('Error in askQuestion:', error);
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
