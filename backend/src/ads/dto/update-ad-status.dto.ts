import { IsIn } from 'class-validator';

export class UpdateAdStatusDto {
  @IsIn(['ACTIVE', 'PAUSED'])
  status: 'ACTIVE' | 'PAUSED';
}
