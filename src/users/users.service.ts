// src/users/users.service.ts
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
    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create the user
    const newUser = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        User_id: BigInt(Date.now()),
      },
    });

    // Assign default customer role if it exists
    try {
      const customerRole = await this.prisma.role.findUnique({
        where: { name: 'customer' },
      });

      if (customerRole) {
        await this.prisma.userRole.create({
          data: {
            user_id: newUser.id,
            role_id: customerRole.id,
          },
        });
      }
    } catch (error) {
      console.error('Failed to assign default role:', error);
    }

    const { password: _password, ...result } = newUser;
    return result;
  }

  async findAll(role?: string) {
    let where = {};

    // If role is specified, filter by the new role system
    if (role) {
      where = {
        roles: {
          some: {
            role: {
              name: role,
            },
          },
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
        role: true,
        created_at: true,
        updated_at: true,
        profile_photo: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Transform the result to include a roles array
    return users.map((user) => {
      const roleNames = user.roles.map((ur) => ur.role.name);
      const { roles: _roles, ...userWithoutRoles } = user;
      return {
        ...userWithoutRoles,
        roles: roleNames,
      };
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        address: true,
        role: true,
        created_at: true,
        updated_at: true,
        profile_photo: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Transform the result to include a roles array
    const roleNames = user.roles.map((ur) => ur.role.name);
    const { roles: _roles, ...userWithoutRoles } = user;

    return {
      ...userWithoutRoles,
      roles: roleNames,
    };
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (user) {
      // Transform the result to include a roles array
      const roleNames = user.roles.map((ur) => ur.role.name);
      return {
        ...user,
        roles: roleNames,
      };
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    // Check if user exists
    await this.findOne(id);

    // If email is being updated, check if the new email is already in use
    if (updateUserDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    // If password is being updated, hash it
    const data = { ...updateUserDto };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        address: true,
        role: true,
        created_at: true,
        updated_at: true,
        profile_photo: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Transform the result to include a roles array
    const roleNames = updatedUser.roles.map((ur) => ur.role.name);
    const { roles: _roles, ...userWithoutRoles } = updatedUser;

    return {
      ...userWithoutRoles,
      roles: roleNames,
    };
  }

  async remove(id: number) {
    // Check if user exists
    await this.findOne(id);

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}
