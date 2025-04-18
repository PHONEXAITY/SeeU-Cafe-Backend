import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Max,
  Min,
} from 'class-validator';

export class SlideshowSettingsDto {
  @ApiProperty({ description: 'Auto-play slides', default: true })
  @IsBoolean()
  @IsOptional()
  autoplay?: boolean;

  @ApiProperty({
    description: 'Interval between slides in milliseconds',
    default: 5000,
  })
  @IsNumber()
  @IsOptional()
  @Min(500)
  @Max(30000)
  interval?: number;

  @ApiProperty({
    description: 'Transition effect',
    enum: ['fade', 'slide', 'zoom'],
    default: 'fade',
  })
  @IsEnum(['fade', 'slide', 'zoom'])
  @IsOptional()
  transition?: string;

  @ApiProperty({
    description: 'Transition duration in milliseconds',
    default: 500,
  })
  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(5000)
  transitionDuration?: number;

  @ApiProperty({ description: 'Show navigation arrows', default: true })
  @IsBoolean()
  @IsOptional()
  showArrows?: boolean;

  @ApiProperty({ description: 'Show navigation dots', default: true })
  @IsBoolean()
  @IsOptional()
  showDots?: boolean;

  @ApiProperty({ description: 'Pause on hover', default: true })
  @IsBoolean()
  @IsOptional()
  pauseOnHover?: boolean;

  @ApiProperty({ description: 'Slideshow height in pixels', default: 600 })
  @IsNumber()
  @IsOptional()
  @Min(200)
  @Max(2000)
  height?: number;

  @ApiProperty({ description: 'Responsive mode', default: true })
  @IsBoolean()
  @IsOptional()
  responsive?: boolean;

  @ApiProperty({ description: 'Maximum number of slides to show', default: 5 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  maxSlides?: number;

  @ApiProperty({ description: 'Enable text overlay', default: true })
  @IsBoolean()
  @IsOptional()
  enableOverlay?: boolean;

  @ApiProperty({
    description: 'Overlay color (CSS color value)',
    default: 'rgba(0, 0, 0, 0.3)',
  })
  @IsString()
  @IsOptional()
  overlayColor?: string;

  @ApiProperty({ description: 'Animate text', default: true })
  @IsBoolean()
  @IsOptional()
  animateText?: boolean;

  @ApiProperty({
    description: 'Text position',
    enum: ['top', 'bottom', 'center', 'none'],
    default: 'bottom',
  })
  @IsEnum(['top', 'bottom', 'center', 'none'])
  @IsOptional()
  textPosition?: string;
}
