import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UserPayload } from '../auth/strategies/jwt.strategy';
import { User } from '../auth/decorators/user.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างผู้ใช้ใหม่ (เฉพาะผู้ดูแลระบบ)' })
  @ApiResponse({ status: 201, description: 'สร้างผู้ใช้สำเร็จ' })
  @ApiResponse({ status: 400, description: 'ข้อมูลไม่ถูกต้อง' })
  @ApiResponse({ status: 401, description: 'ไม่ได้รับอนุญาต' })
  @ApiResponse({ status: 409, description: 'อีเมลซ้ำ' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดึงข้อมูลผู้ใช้ทั้งหมด (เฉพาะผู้ดูแลระบบ)' })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'กรองผู้ใช้ตามบทบาท',
  })
  @ApiResponse({ status: 200, description: 'รายการผู้ใช้' })
  @ApiResponse({ status: 401, description: 'ไม่ได้รับอนุญาต' })
  findAll(@Query('role') role?: string) {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดึงข้อมูลผู้ใช้ตาม ID (เฉพาะผู้ดูแลระบบ)' })
  @ApiResponse({ status: 200, description: 'รายละเอียดผู้ใช้' })
  @ApiResponse({ status: 401, description: 'ไม่ได้รับอนุญาต' })
  @ApiResponse({ status: 404, description: 'ไม่พบผู้ใช้' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'อัปเดตผู้ใช้ (เฉพาะผู้ดูแลระบบ)' })
  @ApiResponse({ status: 200, description: 'อัปเดตผู้ใช้สำเร็จ' })
  @ApiResponse({ status: 401, description: 'ไม่ได้รับอนุญาต' })
  @ApiResponse({ status: 404, description: 'ไม่พบผู้ใช้' })
  @ApiResponse({ status: 409, description: 'อีเมลซ้ำ' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ลบผู้ใช้ (เฉพาะผู้ดูแลระบบ)' })
  @ApiResponse({ status: 200, description: 'ลบผู้ใช้สำเร็จ' })
  @ApiResponse({ status: 401, description: 'ไม่ได้รับอนุญาต' })
  @ApiResponse({ status: 404, description: 'ไม่พบผู้ใช้' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'เปลี่ยนบทบาทของผู้ใช้ (เฉพาะผู้ดูแลระบบ)' })
  @ApiResponse({ status: 200, description: 'เปลี่ยนบทบาทสำเร็จ' })
  @ApiResponse({ status: 401, description: 'ไม่ได้รับอนุญาต' })
  @ApiResponse({ status: 404, description: 'ไม่พบผู้ใช้หรือบทบาท' })
  changeRole(@Param('id') id: string, @Body('role_id') roleId: number) {
    return this.usersService.changeRole(+id, roleId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @User() user: UserPayload,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException(
        'User not authenticated or user ID not available',
      );
    }

    return this.usersService.update(user.id, updateUserDto);
  }

  @Patch('my-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own profile' })
  async updateMyProfile(
    @User() user: UserPayload,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const allowedFields = {
      first_name: updateUserDto.first_name,
      last_name: updateUserDto.last_name,
      phone: updateUserDto.phone,
      address: updateUserDto.address,
      profile_photo: updateUserDto.profile_photo,
    };

    const filteredData = Object.fromEntries(
      Object.entries(allowedFields).filter(([_, value]) => value !== undefined),
    );

    return this.usersService.update(user.id, filteredData);
  }

  @Post('upload-photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload user profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Photo uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePhoto(
    @User() user: UserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException(
        'User not authenticated or user ID not available',
      );
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const uploadResult = await this.cloudinaryService.uploadFile(file);

    await this.usersService.update(Number(user.id), {
      profile_photo: uploadResult.url,
    });

    return { url: uploadResult.url };
  }
}
