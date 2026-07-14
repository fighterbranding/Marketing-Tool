import { IsIn } from 'class-validator';

export class UpdateAdSetStatusDto {
  @IsIn(['ACTIVE', 'PAUSED'])
  status: 'ACTIVE' | 'PAUSED';
}
