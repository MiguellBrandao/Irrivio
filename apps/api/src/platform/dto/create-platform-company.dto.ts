import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlatformCompanyDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(255)
  slug!: string;

  @IsOptional()
  @IsString()
  logo_path?: string;

  @IsOptional()
  @IsString()
  favicon_path?: string;

  @IsString()
  address!: string;

  @IsString()
  @MaxLength(50)
  nif!: string;

  @IsString()
  @MaxLength(50)
  mobile_phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(64)
  iban!: string;

  @IsOptional()
  @IsUUID()
  initial_admin_user_id?: string;

  @IsOptional()
  @IsEmail()
  initial_admin_email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  initial_admin_password?: string;

  @IsString()
  @MaxLength(255)
  initial_admin_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  initial_admin_phone?: string;
}
