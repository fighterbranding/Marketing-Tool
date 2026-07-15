import { IsIn, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

const CTA_TYPES = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'DOWNLOAD',
  'CONTACT_US',
] as const;

export type CtaType = (typeof CTA_TYPES)[number];

export class CreateAdDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  headline: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  bodyText: string;

  @IsIn(CTA_TYPES)
  ctaType: CtaType;

  @IsUrl()
  destinationUrl: string;

  @IsString()
  @MinLength(1)
  pageId: string;
}
