import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('อีเมลนี้มีผู้ใช้งานอยู่แล้ว');
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        User_id: BigInt(Date.now()),
        role_id: createUserDto.role_id || null,
      },
    });
    const userWithRole = await this.prisma.user.findUnique({
      where: { id: newUser.id },
      include: {
        role: true,
      },
    });
    const { password: _, ...result } = userWithRole!;
    return result;
  }

  async findAll(roleName?: string) {
    let where = {};

    if (roleName) {
      where = {
        role: {
          name: roleName,
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        address: true,
        created_at: true,
        updated_at: true,
        profile_photo: true,
        role: true,
      },
    });

    return users.map((user) => ({
      ...user,
      role_name: user.role?.name || null,
    }));
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`ไม่พบผู้ใช้ที่มี ID ${id}`);
    }

    const { password: _, ...result } = user;
    return {
      ...result,
      role_name: user.role?.name || null,
    };
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    if (updateUserDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('อีเมลนี้มีผู้ใช้งานอยู่แล้ว');
      }
    }

    const data = { ...updateUserDto };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        role: true,
      },
    });

    const { password: _, ...result } = updatedUser;
    return {
      ...result,
      role_name: updatedUser.role?.name || null,
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'ลบผู้ใช้สำเร็จ' };
  }

  async changeRole(userId: number, roleId: number) {
    await this.findOne(userId); // Fixed ESLint no-unused-vars
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new NotFoundException(`ไม่พบบทบาทที่มี ID ${roleId}`);
    }
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role_id: roleId },
      include: { role: true },
    });
    const { password: _, ...result } = updatedUser;
    return {
      ...result,
      role_name: updatedUser.role?.name || null,
    };
  }
}
