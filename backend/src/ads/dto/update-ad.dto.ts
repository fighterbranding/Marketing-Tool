import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAdDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
