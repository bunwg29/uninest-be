import { Global, Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [R2StorageService],
  exports: [R2StorageService],
})
export class StorageModule {}
