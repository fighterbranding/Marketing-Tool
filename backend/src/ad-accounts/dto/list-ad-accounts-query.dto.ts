import { IsString, MinLength } from 'class-validator';

export class ListAdAccountsQueryDto {
  @IsString()
  @MinLength(1)
  businessId: string;
}
