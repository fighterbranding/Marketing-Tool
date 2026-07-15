import { IsString, MinLength } from 'class-validator';

export class SelectAdAccountDto {
  @IsString()
  @MinLength(1)
  businessId: string;

  @IsString()
  @MinLength(1)
  adAccountId: string;
}
