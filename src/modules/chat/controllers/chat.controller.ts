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
  @Roles(UserRoleType.STUDENT, UserRoleType.LANDLORD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sinh viên mở cuộc trò chuyện với chủ trọ của tin đăng; chủ trọ mở cuộc trò chuyện với sinh viên đã đặt lịch xem phòng',
  })
  async createOrGet(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRoleType,
    @Body() dto: CreateConversationDto,
  ) {
    return role === UserRoleType.LANDLORD
      ? this.chatService.createOrGetConversationForLandlord(userId, dto)
      : this.chatService.createOrGetConversation(userId, dto);
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
