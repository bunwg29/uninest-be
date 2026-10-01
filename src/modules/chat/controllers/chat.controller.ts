import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  ConversationsQueryDto,
  CreateConversationDto,
  EditMessageDto,
  MessagesQueryDto,
  SendMessageDto,
} from '../dtos';
import { ChatService } from '../services/chat.service';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @Roles(UserRoleType.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tạo hoặc mở lại cuộc trò chuyện với chủ trọ từ một tin đăng',
  })
  async createOrGet(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.createOrGetConversation(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách hội thoại của người dùng hiện tại' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: ConversationsQueryDto,
  ) {
    return this.chatService.listConversations(userId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Tổng hợp số hội thoại và tin nhắn chưa đọc (badge tab Tin nhắn)',
  })
  async getSummary(@CurrentUser('userId') userId: string) {
    return this.chatService.getSummary(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một cuộc trò chuyện' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.getConversation(userId, id);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary:
      'Lịch sử tin nhắn của cuộc trò chuyện (mới nhất trước, có phân trang)',
  })
  async findMessages(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.chatService.listMessages(userId, id, query);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Gửi tin nhắn qua REST (dự phòng khi kết nối realtime gián đoạn)',
  })
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    const { message } = await this.chatService.sendMessage(userId, id, dto);

    return message;
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc toàn bộ tin nhắn của đối phương' })
  async markRead(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.markConversationRead(userId, id);
  }

  @Patch(':id/messages/:messageId')
  @ApiOperation({
    summary: 'Chỉnh sửa nội dung tin nhắn của chính mình trong vòng 24 giờ',
  })
  async editMessage(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(userId, id, messageId, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Xoá đoạn chat phía người dùng hiện tại (người kia vẫn giữ nguyên lịch sử)',
  })
  async deleteConversation(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.deleteConversation(userId, id);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({
    summary: 'Thu hồi (ẩn) tin nhắn của chính mình trong vòng 24 giờ',
  })
  async recallMessage(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.recallMessage(userId, id, messageId);
  }
}
