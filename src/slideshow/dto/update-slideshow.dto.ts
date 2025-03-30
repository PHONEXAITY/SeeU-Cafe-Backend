import { PartialType } from '@nestjs/swagger';
import { CreateSlideshowDto } from './create-slideshow.dto';

export class UpdateSlideshowDto extends PartialType(CreateSlideshowDto) {}
