import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = unknown> {
  @ApiProperty({
    example: true,
    description:
      'Status of the request execution (true for success, false for error)',
  })
  status!: boolean;

  @ApiPropertyOptional({
    description: 'Data payload returned by the endpoint (null on failure)',
  })
  data!: T | null;

  @ApiPropertyOptional({
    example: null,
    description: 'Error code or error classification name (null on success)',
  })
  error!: string | null;

  @ApiProperty({
    example: 'Operation completed successfully',
    description: 'Response message or array of validation error messages',
  })
  messages!: string | string[];
}

export function createApiResponse<T>(
  data: T | null = null,
  messages: string | string[] = 'Operation completed successfully',
  status: boolean = true,
  error: string | null = null,
): ApiResponseDto<T> {
  return {
    status,
    data,
    error,
    messages,
  };
}
