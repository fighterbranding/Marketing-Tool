import { IsIn } from 'class-validator';

export class UpdateCampaignStatusDto {
  @IsIn(['ACTIVE', 'PAUSED'])
  status: 'ACTIVE' | 'PAUSED';
}
