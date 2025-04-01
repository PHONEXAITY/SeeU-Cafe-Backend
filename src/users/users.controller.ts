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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
