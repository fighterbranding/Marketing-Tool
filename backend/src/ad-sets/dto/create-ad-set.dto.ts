import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TargetingSpecDto } from './targeting-spec.dto';

const OPTIMIZATION_GOALS = [
  'LINK_CLICKS',
  'REACH',
  'IMPRESSIONS',
  'OFFSITE_CONVERSIONS',
] as const;

export type OptimizationGoal = (typeof OPTIMIZATION_GOALS)[number];

export class CreateAdSetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  // Smallest currency unit (cents for USD) — see docs/03-meta-api/marketing-api.md.
  @IsInt()
  @Min(100)
  dailyBudgetCents: number;

  @IsIn(OPTIMIZATION_GOALS)
  optimizationGoal: OptimizationGoal;

  @ValidateNested()
  @Type(() => TargetingSpecDto)
  targeting: TargetingSpecDto;
}
