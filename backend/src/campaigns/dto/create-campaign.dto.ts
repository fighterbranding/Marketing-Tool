import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const OBJECTIVES = [
  'OUTCOME_TRAFFIC',
  'OUTCOME_SALES',
  'OUTCOME_LEADS',
  'OUTCOME_AWARENESS',
] as const;

export type CampaignObjective = (typeof OBJECTIVES)[number];

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsIn(OBJECTIVES)
  objective: CampaignObjective;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialAdCategories?: string[];
}
