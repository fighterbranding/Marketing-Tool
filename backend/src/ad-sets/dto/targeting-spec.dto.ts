import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const PLATFORMS = ['facebook', 'instagram'] as const;

export class TargetingInterestDto {
  @IsString()
  id: string;

  @IsString()
  @MaxLength(100)
  name: string;
}

export class TargetingSpecDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  countries: string[];

  @IsInt()
  @Min(13)
  @Max(65)
  ageMin: number;

  @IsInt()
  @Min(13)
  @Max(65)
  ageMax: number;

  @IsArray()
  @IsIn(PLATFORMS, { each: true })
  platforms: string[];

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => TargetingInterestDto)
  interests: TargetingInterestDto[];
}
