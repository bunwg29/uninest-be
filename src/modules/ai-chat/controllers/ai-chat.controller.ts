import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { PaginationQueryDto } from '@common/dtos';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { SendAiMessageDto } from '../dtos';
import { AiChatService } from '../services';

@ApiTags('Trợ lý AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.STUDENT)
@Controller('ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hỏi trợ lý AI tìm phòng (RAG trên tin đang hiển thị)',
    description:
      'Trích xuất tiêu chí, tìm vector kết hợp lọc cấu trúc và trả câu trả lời kèm danh sách listingId thật.',
  })
  @ApiOkResponse({ description: 'Câu trả lời của trợ lý AI' })
  sendMessage(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendAiMessageDto,
  ) {
    return this.aiChatService.sendMessage(userId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Lịch sử cuộc trò chuyện với trợ lý AI (AI-06)' })
  listConversations(
    @CurrentUser('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.aiChatService.listConversations(userId, query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Chi tiết một cuộc trò chuyện với trợ lý AI' })
  getConversation(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.aiChatService.getConversation(userId, id);
  }

  @Delete('conversations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá toàn bộ lịch sử trò chuyện với trợ lý AI' })
  async deleteAllConversations(
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.aiChatService.deleteAllConversations(userId);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá một cuộc trò chuyện với trợ lý AI' })
  async deleteConversation(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.aiChatService.deleteConversation(userId, id);
  }
}
