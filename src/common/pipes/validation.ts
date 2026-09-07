import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

export const createGlobalValidationPipe = (options?: ValidationPipeOptions) => {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    ...options,
  });
};
